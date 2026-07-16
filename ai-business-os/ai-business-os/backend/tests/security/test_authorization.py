"""Security regression tests for the centralized authorization dependencies.

Covers the invariants from Part 3.1 §8 (authorization hardening):
  * `get_current_active_user` re-derives role/permissions from the DB and
    never trusts the token's embedded claims.
  * A suspended / deactivated / soft-deleted user fails closed (401), even
    though their access token is still cryptographically valid.
  * A deactivated / deleted tenant fails closed (401) for all its members.
  * `require_permission` denies by default — missing/unknown permission,
    or no permission at all, always denies (403); it never falls back to
    "allow" on ambiguity.
  * `require_roles` re-checks the *current* DB role, not the stale token
    role, so a demoted user loses access immediately.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import uuid  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.exceptions import ForbiddenError, UnauthorizedError  # noqa: E402
from app.dependencies.auth import (  # noqa: E402
    CurrentUser,
    get_current_active_user,
    require_permission,
    require_roles,
)
from app.models import Company, Permission, Role, User  # noqa: E402
from app.models.enums import UserStatus  # noqa: E402


@pytest_asyncio.fixture
async def tenant_with_user():
    """One company, one role ("manager") with a "customers.read" permission,
    one active user holding that role. Cleaned up afterwards."""
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        company = Company(name="AuthZ Co", slug=f"authz-{os.urandom(4).hex()}")
        db.add(company)
        await db.flush()

        perm_name = f"customers.read.{os.urandom(4).hex()}"
        permission = Permission(name=perm_name)
        db.add(permission)
        await db.flush()

        role = Role(company_id=company.id, name="manager")
        role.permissions = [permission]
        db.add(role)
        await db.flush()

        user = User(
            company_id=company.id,
            first_name="Ada",
            last_name="Lovelace",
            email=f"ada-{os.urandom(4).hex()}@example.com",
            status=UserStatus.ACTIVE,
        )
        user.roles = [role]
        db.add(user)
        await db.commit()

        yield db, company, role, permission, user

        await db.delete(user)
        await db.delete(role)
        await db.delete(permission)
        await db.delete(company)
        await db.commit()
    await engine.dispose()


def _token_for(user: User, *, company_id=None, role: str = "attacker-forged-role") -> CurrentUser:
    """Simulates the *claims embedded in the JWT* — deliberately wrong/stale
    values to prove `get_current_active_user` ignores them and re-derives
    everything from the database instead."""
    return CurrentUser(
        id=user.id,
        company_id=company_id or uuid.uuid4(),  # forged/stale tenant claim
        role=role,  # forged/stale role claim
    )


@pytest.mark.asyncio
async def test_active_user_permissions_are_hydrated_from_db_not_token(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    token_user = _token_for(user)

    resolved = await get_current_active_user(token_user, db)

    assert resolved.company_id == company.id, "must use DB company_id, not the token's"
    assert resolved.role == "manager", "must use DB role, not the token's forged role"
    assert permission.name in resolved.permissions


@pytest.mark.asyncio
async def test_suspended_user_fails_closed(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    user.status = UserStatus.SUSPENDED
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await get_current_active_user(_token_for(user), db)


@pytest.mark.asyncio
async def test_deactivated_user_fails_closed(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    user.is_active = False
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await get_current_active_user(_token_for(user), db)


@pytest.mark.asyncio
async def test_soft_deleted_user_fails_closed(tenant_with_user):
    from sqlalchemy import func

    db, company, role, permission, user = tenant_with_user
    user.deleted_at = func.now()
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await get_current_active_user(_token_for(user), db)


@pytest.mark.asyncio
async def test_deactivated_company_fails_closed_for_its_members(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    company.is_active = False
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await get_current_active_user(_token_for(user), db)


@pytest.mark.asyncio
async def test_deleted_company_fails_closed_for_its_members(tenant_with_user):
    from sqlalchemy import func

    db, company, role, permission, user = tenant_with_user
    company.deleted_at = func.now()
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await get_current_active_user(_token_for(user), db)


@pytest.mark.asyncio
async def test_require_permission_allows_holder(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    checker = require_permission(permission.name)

    resolved = await checker(await get_current_active_user(_token_for(user), db))
    assert resolved.id == user.id


@pytest.mark.asyncio
async def test_require_permission_denies_by_default(tenant_with_user):
    """Deny-by-default: an unrelated/unknown permission must never be
    satisfied by holding some other permission."""
    db, company, role, permission, user = tenant_with_user
    checker = require_permission("finance.manage")

    current = await get_current_active_user(_token_for(user), db)
    with pytest.raises(ForbiddenError):
        await checker(current)


@pytest.mark.asyncio
async def test_require_permission_denies_user_with_no_roles(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    user.roles = []
    await db.flush()

    checker = require_permission(permission.name)
    current = await get_current_active_user(_token_for(user), db)
    with pytest.raises(ForbiddenError):
        await checker(current)


@pytest.mark.asyncio
async def test_require_roles_uses_fresh_db_role_not_stale_token_role(tenant_with_user):
    """A user demoted after token issuance must lose access on the very
    next request — require_roles must never trust the JWT's role claim."""
    db, company, role, permission, user = tenant_with_user
    checker = require_roles("owner", "admin")

    # Token claims "owner" (forged/stale), but the DB role is "manager".
    current = await get_current_active_user(_token_for(user, role="owner"), db)
    with pytest.raises(ForbiddenError):
        await checker(current)


@pytest.mark.asyncio
async def test_require_roles_allows_matching_db_role(tenant_with_user):
    db, company, role, permission, user = tenant_with_user
    checker = require_roles("manager")

    current = await get_current_active_user(_token_for(user), db)
    resolved = await checker(current)
    assert resolved.role == "manager"


@pytest.mark.asyncio
async def test_multi_role_primary_role_is_deterministic(tenant_with_user):
    """Part 3.1 remediation, SEC-002.

    Root cause: `User.roles` is a plain many-to-many relationship with no
    `order_by`; `roles[0]` (used for the JWT `role` claim and
    `require_roles()`) was therefore whatever order SQLAlchemy/Postgres
    happened to return, not a deterministic business rule. Not reachable
    today (registration assigns exactly one role) but latent.

    This proves the fix (`order_by="Role.name"` on `User.roles`,
    `app/models/user.py`): a user holding two roles resolves to the *same*
    primary role every time, regardless of the order the roles were
    assigned/attached in, and regardless of re-fetching the user from a
    fresh session (ruling out mere Python-list-append-order artifacts)."""
    db, company, role, permission, user = tenant_with_user
    user_id = user.id  # captured before any expiry below

    second_role = Role(company_id=company.id, name="admin")
    db.add(second_role)
    await db.flush()

    # Attach in one order, then the other, on separate fresh loads —
    # `roles[0]` must land on the same role name both times purely because
    # of the DB-level `ORDER BY roles.name`, not attachment order.
    user.roles = [role, second_role]  # "manager", "admin"
    await db.commit()

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async def _load_primary_role_name() -> str:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.roles))
            .execution_options(populate_existing=True)
        )
        fresh = (await db.execute(stmt)).scalar_one()
        return fresh.roles[0].name

    first_result = await _load_primary_role_name()

    user.roles = [second_role, role]  # "admin", "manager" — reversed attach order
    await db.commit()

    second_result = await _load_primary_role_name()

    assert first_result == second_result == "admin", (
        "roles[0] must be the same, alphabetically-first-by-name role "
        "regardless of attachment order — proving determinism, not "
        "asserting a privilege hierarchy"
    )

    await db.delete(second_role)
    await db.commit()
