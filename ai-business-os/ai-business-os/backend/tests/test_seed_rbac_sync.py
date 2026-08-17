"""Tests for permission catalog seed + system role_permissions backfill."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.orm import selectinload  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.db.seed import (  # noqa: E402
    DEFAULT_ROLES,
    all_permission_names,
    expand,
    seed_permissions,
    sync_system_role_permissions,
)
from app.models import Company, Role, role_permissions  # noqa: E402


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_sync_system_role_permissions_backfills_owner_crm_grants(db):
    """Owner system roles with empty grants must receive customers.read after sync."""
    await seed_permissions(db)

    company = Company(
        name="RBAC Sync Co",
        slug=f"rbac-sync-{os.urandom(3).hex()}",
        email=f"rbac-{os.urandom(2).hex()}@example.com",
    )
    db.add(company)
    await db.flush()

    owner = Role(company_id=company.id, name="Owner", is_system=True)
    db.add(owner)
    await db.flush()
    owner_id = owner.id
    company_id = company.id
    await db.execute(role_permissions.delete().where(role_permissions.c.role_id == owner_id))
    await db.commit()

    added = await sync_system_role_permissions(db)
    await db.commit()
    assert added >= len(all_permission_names())

    hydrated = (
        await db.execute(
            select(Role)
            .where(Role.id == owner_id)
            .options(selectinload(Role.permissions))
        )
    ).scalar_one()
    names = {p.name for p in hydrated.permissions}
    assert "customers.read" in names
    assert names == set(all_permission_names())

    assert await sync_system_role_permissions(db) == 0

    await db.execute(role_permissions.delete().where(role_permissions.c.role_id == owner_id))
    role_row = (await db.execute(select(Role).where(Role.id == owner_id))).scalar_one()
    await db.delete(role_row)
    company_row = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one()
    await db.delete(company_row)
    await db.commit()


@pytest.mark.asyncio
async def test_sync_does_not_modify_custom_roles(db):
    await seed_permissions(db)
    company = Company(
        name="Custom Role Co",
        slug=f"custom-{os.urandom(3).hex()}",
        email=f"c-{os.urandom(2).hex()}@example.com",
    )
    db.add(company)
    await db.flush()

    custom = Role(company_id=company.id, name=f"Sales-{os.urandom(2).hex()}", is_system=False)
    db.add(custom)
    await db.flush()
    custom_id = custom.id
    company_id = company.id
    await db.commit()

    await sync_system_role_permissions(db)
    await db.commit()

    db.expire_all()
    hydrated = (
        await db.execute(
            select(Role)
            .where(Role.id == custom_id)
            .options(selectinload(Role.permissions))
        )
    ).scalar_one()
    assert [p.name for p in hydrated.permissions] == []

    await db.execute(role_permissions.delete().where(role_permissions.c.role_id == custom_id))
    role_row = (await db.execute(select(Role).where(Role.id == custom_id))).scalar_one()
    await db.delete(role_row)
    company_row = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one()
    await db.delete(company_row)
    await db.commit()


def test_expand_owner_includes_all_crm_permissions():
    names = expand(DEFAULT_ROLES["Owner"])
    for module in ("customers", "contacts", "leads", "deals"):
        for action in ("read", "create", "update", "delete"):
            assert f"{module}.{action}" in names


def test_expand_owner_includes_all_employee_permissions():
    names = expand(DEFAULT_ROLES["Owner"])
    for perm in (
        "employees.read",
        "employees.read_compensation",
        "employees.read_self",
        "employees.read_team",
        "employees.create",
        "employees.update",
        "employees.delete",
    ):
        assert perm in names
