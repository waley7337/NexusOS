"""Session-security regression tests not already covered by
`tests/test_auth_service.py` (rotation, reuse-detection, logout revocation).
This file focuses specifically on expiry: a session past `expires_at` must
never be refreshable, independent of the JWT's own `exp` claim.
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.core.exceptions import UnauthorizedError  # noqa: E402
from app.core.security import decode_token  # noqa: E402
from app.models import Permission, Session  # noqa: E402
from app.schemas.auth import RefreshRequest, RegisterRequest  # noqa: E402
from app.services import auth_service  # noqa: E402

_EMAIL_DOMAIN = "example.com"


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        if not (await session.execute(select(Permission.id).limit(1))).first():
            from app.db.seed import all_permission_names

            for name in all_permission_names():
                session.add(Permission(name=name, description=name))
            await session.commit()
        yield session
        await session.rollback()
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _cleanup():
    """Function-scoped: unlike `test_auth_service.py`'s module-scoped sweep,
    this runs inside the *same* already-running event loop pytest-asyncio
    gave the test, so it must `await` the sweep directly rather than
    `asyncio.run()` (which would fail with "cannot be called from a running
    event loop"). A fresh NullPool engine is still used to avoid any risk of
    sharing pooled connections across tests/loops."""
    yield

    from sqlalchemy import delete

    from app.models import AuditLog, AuthToken, Company, Role, User, role_permissions, user_roles

    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        user_ids = (
            await db.execute(select(User.id).where(User.email.like(f"%@{_EMAIL_DOMAIN}")))
        ).scalars().all()
        company_ids = (
            await db.execute(select(User.company_id).where(User.id.in_(user_ids)))
        ).scalars().all()
        role_ids = (
            await db.execute(select(Role.id).where(Role.company_id.in_(company_ids)))
        ).scalars().all()
        if company_ids:
            await db.execute(delete(AuditLog).where(AuditLog.company_id.in_(company_ids)))
        if user_ids:
            await db.execute(delete(Session).where(Session.user_id.in_(user_ids)))
            await db.execute(delete(AuthToken).where(AuthToken.user_id.in_(user_ids)))
            await db.execute(user_roles.delete().where(user_roles.c.user_id.in_(user_ids)))
        if role_ids:
            await db.execute(role_permissions.delete().where(role_permissions.c.role_id.in_(role_ids)))
            await db.execute(delete(Role).where(Role.id.in_(role_ids)))
        if user_ids:
            await db.execute(delete(User).where(User.id.in_(user_ids)))
        if company_ids:
            await db.execute(delete(Company).where(Company.id.in_(company_ids)))
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_expired_session_row_cannot_refresh_even_with_well_formed_jwt(db):
    """Simulates a refresh JWT that is still within its own `exp` claim, but
    whose server-side `Session` row has separately expired (e.g. an operator
    shortened session TTL, or clock skew) — the row's `expires_at` must be
    authoritative, not just the JWT's embedded claim."""
    result = await auth_service.register(
        db,
        RegisterRequest(
            companyName="Expiry Co", firstName="Ada", lastName="Lovelace",
            email="expiry@example.com", password="Secret123x",
        ),
    )

    payload = decode_token(result.refresh_token, expected_type="refresh")
    session_row = (
        await db.execute(select(Session).where(Session.jti == payload["jti"]))
    ).scalar_one()
    session_row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    await db.flush()

    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=result.refresh_token))


@pytest.mark.asyncio
async def test_non_expired_session_can_still_refresh(db):
    """Sanity check: the expiry check doesn't false-positive on a healthy,
    unexpired session."""
    result = await auth_service.register(
        db,
        RegisterRequest(
            companyName="Healthy Co", firstName="Ada", lastName="Lovelace",
            email="healthy@example.com", password="Secret123x",
        ),
    )

    rotated = await auth_service.refresh(db, RefreshRequest(refreshToken=result.refresh_token))
    assert rotated.access_token
    assert rotated.refresh_token
