"""Integration tests for the Part 3 schema — run against real PostgreSQL.

These verify the flagship guarantees:
  1. Tenant isolation: company A can never see company B's rows
  2. Fail-closed: querying a tenant model without company_id raises
  3. Per-tenant uniqueness: same email may exist in two companies
  4. Soft delete: deleted rows vanish from queries but stay in the table

Skipped automatically when TEST_DATABASE_URL isn't set (e.g. CI without pg).
"""
import os
import uuid

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

from app.core.exceptions import (  # noqa: E402
    NotFoundError,
    TenantIsolationError,
    ValidationError,
)
from app.models import Company, Customer, User  # noqa: E402
from app.repositories.crm import CustomerRepository  # noqa: E402


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


@pytest.mark.asyncio
async def test_cannot_restore_across_tenants(two_tenants):
    """Company A soft-deletes its own row; Company B must not be able to
    discover or restore it, even by guessing the UUID."""
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)
    repo_b = CustomerRepository(db, company_id=b.id)

    await repo_a.soft_delete(ca.id)

    with pytest.raises(NotFoundError):
        await repo_b.restore(ca.id)

    # Owning tenant can restore its own row.
    restored = await repo_a.restore(ca.id)
    assert restored.deleted_at is None


@pytest.mark.asyncio
async def test_list_deleted_is_tenant_scoped(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)
    repo_b = CustomerRepository(db, company_id=b.id)

    await repo_a.soft_delete(ca.id)
    await repo_b.soft_delete(cb.id)

    deleted_a, total_a = await repo_a.list_deleted()
    assert {r.id for r in deleted_a} == {ca.id}
    assert total_a == 1

    # Restore so the shared fixture teardown can clean up normally.
    await repo_a.restore(ca.id)
    await repo_b.restore(cb.id)


@pytest.mark.asyncio
async def test_update_rejects_protected_fields(two_tenants):
    """A caller must never be able to reassign company_id (or any other
    protected/security column) through a generic update() call — this is
    the mass-assignment guard at the repository layer."""
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    with pytest.raises(ValidationError):
        await repo_a.update(ca.id, {"company_id": b.id})

    # Row is untouched.
    unchanged = await repo_a.get(ca.id)
    assert unchanged.company_id == a.id


@pytest.mark.asyncio
async def test_update_rejects_unknown_field(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    with pytest.raises(ValidationError):
        await repo_a.update(ca.id, {"not_a_real_column": "x"})


@pytest.mark.asyncio
async def test_update_cannot_target_another_tenants_row(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    with pytest.raises(NotFoundError):
        await repo_a.update(cb.id, {"company_name": "Hijacked"})

    # B's row is untouched.
    still_b = await CustomerRepository(db, company_id=b.id).get(cb.id)
    assert still_b.company_name == "Globex (B)"


@pytest.mark.asyncio
async def test_update_applies_allowed_field_and_stamps_updated_by(two_tenants):
    db, a, b, ca, cb = two_tenants
    actor = User(
        company_id=a.id, first_name="Actor", last_name="One",
        email=f"actor-{os.urandom(4).hex()}@example.com",
    )
    db.add(actor)
    await db.flush()
    repo_a = CustomerRepository(db, company_id=a.id, user_id=actor.id)

    updated = await repo_a.update(ca.id, {"company_name": "Acme Renamed"})
    assert updated.company_name == "Acme Renamed"
    assert updated.updated_by == actor.id

    await db.delete(actor)
    await db.flush()


@pytest.mark.asyncio
async def test_list_pagination_is_clamped_server_side(two_tenants):
    """page/page_size are always clamped to safe bounds — a caller cannot
    force an unbounded page_size or a negative/zero page."""
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    from app.repositories.base import MAX_PAGE_SIZE

    rows, total = await repo_a.list(page=0, page_size=10_000)
    assert total >= 1
    # Clamped page_size must never exceed MAX_PAGE_SIZE regardless of input.
    assert len(rows) <= MAX_PAGE_SIZE


@pytest.mark.asyncio
async def test_list_rejects_unknown_sort_field(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    with pytest.raises(ValidationError):
        await repo_a.list(sort_by="'; DROP TABLE customers; --")


@pytest.mark.asyncio
async def test_count_and_exists_are_tenant_scoped(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    assert await repo_a.exists(ca.id) is True
    assert await repo_a.exists(cb.id) is False, "TENANT LEAK: exists() saw another tenant's row"

    count_a = await repo_a.count()
    assert count_a == 1  # only ca belongs to tenant A


@pytest.mark.asyncio
async def test_bulk_get_is_tenant_scoped_and_bounded(two_tenants):
    db, a, b, ca, cb = two_tenants
    repo_a = CustomerRepository(db, company_id=a.id)

    rows = await repo_a.bulk_get([ca.id, cb.id])
    assert {r.id for r in rows} == {ca.id}, "TENANT LEAK: bulk_get returned another tenant's row"

    from app.repositories.base import MAX_BULK_IDS

    with pytest.raises(ValidationError):
        await repo_a.bulk_get([uuid.uuid4() for _ in range(MAX_BULK_IDS + 1)])


@pytest.mark.asyncio
async def test_hard_delete_is_tenant_scoped(two_tenants):
    """hard_delete must go through the same tenant-scoped get() as
    everything else — company B can never hard-delete company A's row."""
    db, a, b, ca, cb = two_tenants
    repo_b = CustomerRepository(db, company_id=b.id)

    with pytest.raises(NotFoundError):
        await repo_b.hard_delete(ca.id)

    still_there = await db.execute(select(Customer).where(Customer.id == ca.id))
    assert still_there.scalar_one() is not None
