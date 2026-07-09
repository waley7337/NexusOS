"""Integration tests for the Part 3 schema — run against real PostgreSQL.

These verify the flagship guarantees:
  1. Tenant isolation: company A can never see company B's rows
  2. Fail-closed: querying a tenant model without company_id raises
  3. Per-tenant uniqueness: same email may exist in two companies
  4. Soft delete: deleted rows vanish from queries but stay in the table

Skipped automatically when TEST_DATABASE_URL isn't set (e.g. CI without pg).
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.exceptions import TenantIsolationError  # noqa: E402
from app.models import Company, Customer, User  # noqa: E402
from app.repositories.base import BaseRepository  # noqa: E402


class CustomerRepository(BaseRepository[Customer]):
    model = Customer


@pytest_asyncio.fixture
async def two_tenants():
    """Two companies, one customer each. Cleaned up afterwards.

    NullPool: pytest-asyncio runs each test in its own event loop, so
    connections must not be pooled across tests."""
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        a = Company(name="Tenant A", slug=f"tenant-a-{os.urandom(4).hex()}")
        b = Company(name="Tenant B", slug=f"tenant-b-{os.urandom(4).hex()}")
        db.add_all([a, b])
        await db.flush()

        ca = Customer(company_id=a.id, company_name="Acme (A)")
        cb = Customer(company_id=b.id, company_name="Globex (B)")
        db.add_all([ca, cb])
        await db.commit()

        yield db, a, b, ca, cb

        await db.delete(ca)
        await db.delete(cb)
        await db.delete(a)
        await db.delete(b)
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_tenant_a_cannot_see_tenant_b(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    rows, total = await repo_a.list()
    ids = {r.id for r in rows}

    assert ca.id in ids
    assert cb.id not in ids, "TENANT LEAK: company A saw company B's customer"


@pytest.mark.asyncio
async def test_get_across_tenants_returns_not_found(two_tenants):
    from app.core.exceptions import NotFoundError

    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    with pytest.raises(NotFoundError):
        await repo_a.get(cb.id)  # B's row through A's scope → 404, never data


@pytest.mark.asyncio
async def test_querying_tenant_model_without_company_fails_closed(two_tenants):
    db, *_ = two_tenants
    repo = CustomerRepository(db, company_id=None)

    with pytest.raises(TenantIsolationError):
        await repo.list()


@pytest.mark.asyncio
async def test_same_email_allowed_in_two_companies(two_tenants):
    db, a, b, *_ = two_tenants
    u1 = User(company_id=a.id, first_name="Sam", last_name="One", email="sam@example.com")
    u2 = User(company_id=b.id, first_name="Sam", last_name="Two", email="sam@example.com")
    db.add_all([u1, u2])
    await db.flush()  # would raise IntegrityError if uniqueness were global

    # …but duplicated within ONE company must fail
    dup = User(company_id=a.id, first_name="Sam", last_name="Dup", email="sam@example.com")
    db.add(dup)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_soft_delete_hides_but_keeps_row(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    await repo_a.soft_delete(ca.id)

    rows, _ = await repo_a.list()
    assert ca.id not in {r.id for r in rows}, "soft-deleted row still visible"

    # Row physically still exists (unscoped check, test-only)
    raw = await db.execute(select(Customer).where(Customer.id == ca.id))
    row = raw.scalar_one()
    assert row.deleted_at is not None
