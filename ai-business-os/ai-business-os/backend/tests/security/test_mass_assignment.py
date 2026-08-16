"""Mass-assignment protection regression tests.

Complements the protected-field coverage already in
`tests/test_tenant_isolation.py` (`BaseRepository.update` rejecting
`company_id`/`id`/`created_by`/etc. and unknown fields). This file covers the
two gaps that suite doesn't: `create()` overwriting a forged `company_id`
set directly on the entity, and the auth *request schemas* never exposing
security-sensitive fields (role, company_id, is_admin) for a client to set in
the first place.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.models import Company, Customer  # noqa: E402
from app.repositories.crm import CustomerRepository  # noqa: E402
from app.schemas.auth import RegisterRequest  # noqa: E402


@pytest_asyncio.fixture
async def two_tenants():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        a = Company(name="Tenant A", slug=f"ma-a-{os.urandom(4).hex()}")
        b = Company(name="Tenant B", slug=f"ma-b-{os.urandom(4).hex()}")
        db.add_all([a, b])
        await db.commit()

        yield db, a, b

        await db.delete(a)
        await db.delete(b)
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_create_ignores_forged_company_id_on_the_entity(two_tenants):
    """A caller might build the entity from a client payload before handing
    it to the repository (e.g. `Customer(**payload.model_dump())`) — if that
    payload carried a `company_id`, `create()` must overwrite it with the
    trusted context rather than trusting whatever was already set."""
    db, a, b = two_tenants
    repo = CustomerRepository(db, company_id=a.id)

    # Simulates a forged/mistaken company_id baked into the entity already —
    # e.g. from a naive `Customer(**client_payload)` construction.
    forged = Customer(company_id=b.id, company_name="Should Belong To A")

    created = await repo.create(forged)

    assert created.company_id == a.id, "create() must not trust a pre-set company_id"
    assert created.company_id != b.id

    await db.delete(created)
    await db.commit()


@pytest.mark.asyncio
async def test_create_requires_tenant_context_fails_closed(two_tenants):
    db, a, b = two_tenants
    repo = CustomerRepository(db, company_id=None)

    from app.core.exceptions import TenantIsolationError

    with pytest.raises(TenantIsolationError):
        await repo.create(Customer(company_name="Orphan"))


def test_register_schema_has_no_role_field():
    """Role/company_id/is_admin must not be assignable through registration
    at all — proven here by their simple absence from the schema, which is
    stronger than trusting `extra="ignore"` to silently drop them."""
    fields = RegisterRequest.model_fields.keys()
    assert "role" not in fields
    assert "company_id" not in fields
    assert "is_admin" not in fields
    assert "permissions" not in fields


def test_register_schema_ignores_unexpected_privileged_fields():
    """Even if a malicious client stuffs privileged-looking keys into the
    request body, pydantic's default `extra="ignore"` means they never reach
    a Python attribute the service layer could accidentally read."""
    payload = RegisterRequest.model_validate(
        {
            "companyName": "Attacker Co",
            "firstName": "Eve",
            "lastName": "Attacker",
            "email": "eve@example.com",
            "password": "Secret123x",
            "role": "owner",
            "companyId": "11111111-1111-1111-1111-111111111111",
            "isAdmin": True,
        }
    )
    assert not hasattr(payload, "role")
    assert not hasattr(payload, "is_admin")
    assert payload.company_name == "Attacker Co"
