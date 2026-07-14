"""Integration tests for `app.services.auth_service` — run against real
PostgreSQL (see `tests/test_tenant_isolation.py` for the pattern this
follows: NullPool, one session per test, explicit cleanup).
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

from app.core.exceptions import UnauthorizedError, ValidationError  # noqa: E402
from app.dependencies.auth import CurrentUser  # noqa: E402
from app.models import AuthToken, Company, Permission, Session, User  # noqa: E402
from app.services import auth_service  # noqa: E402
from app.schemas.auth import (  # noqa: E402
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        # `register` needs the global permission catalog seeded, same as a
        # real deploy (`python -m app.db.seed`).
        if not (await session.execute(select(Permission.id).limit(1))).first():
            from app.db.seed import all_permission_names

            for name in all_permission_names():
                session.add(Permission(name=name, description=name))
            await session.commit()
        yield session
        await session.rollback()
    await engine.dispose()


async def _register(db, *, email="owner@example.com", company="Test Co", password="Secret123x"):
    return await auth_service.register(
        db,
        RegisterRequest(
            companyName=company, firstName="Ada", lastName="Lovelace", email=email, password=password
        ),
    )


@pytest.mark.asyncio
async def test_register_creates_company_owner_and_session(db):
    result = await _register(db)

    assert result.user.role == "owner"
    assert result.user.email_verified is False
    assert result.access_token and result.refresh_token

    company = (
        await db.execute(select(Company).where(Company.id == result.user.company_id))
    ).scalar_one()
    assert company.name == "Test Co"
    assert company.slug  # generated

    sessions = (await db.execute(select(Session).where(Session.user_id == result.user.id))).scalars().all()
    assert len(sessions) == 1


@pytest.mark.asyncio
async def test_register_generates_unique_slugs_for_same_company_name(db):
    a = await _register(db, email="a@example.com", company="Shared Name")
    b = await _register(db, email="b@example.com", company="Shared Name")

    company_a = (await db.execute(select(Company).where(Company.id == a.user.company_id))).scalar_one()
    company_b = (await db.execute(select(Company).where(Company.id == b.user.company_id))).scalar_one()
    assert company_a.slug != company_b.slug


@pytest.mark.asyncio
async def test_register_rejects_weak_password():
    with pytest.raises(ValueError):
        RegisterRequest(
            companyName="Weak Co", firstName="A", lastName="B", email="weak@example.com", password="alllettersnodigits"
        )


@pytest.mark.asyncio
async def test_login_succeeds_with_correct_password_and_fails_otherwise(db):
    await _register(db, email="login@example.com", password="CorrectHorse1")

    ok = await auth_service.login(db, LoginRequest(email="login@example.com", password="CorrectHorse1"))
    assert ok.user.email == "login@example.com"

    with pytest.raises(UnauthorizedError):
        await auth_service.login(db, LoginRequest(email="login@example.com", password="WrongPassword1"))


@pytest.mark.asyncio
async def test_same_email_may_register_two_separate_companies(db):
    """Per database.md: the same person can belong to two tenants — the
    (company_id, email) constraint is per-company, not global."""
    a = await _register(db, email="multi@example.com", company="Company A")
    b = await _register(db, email="multi@example.com", company="Company B")
    assert a.user.company_id != b.user.company_id


@pytest.mark.asyncio
async def test_refresh_rotates_and_rejects_reuse(db):
    session = await _register(db, email="refresh@example.com")

    rotated = await auth_service.refresh(db, RefreshRequest(refreshToken=session.refresh_token))
    assert rotated.access_token != session.access_token
    assert rotated.refresh_token != session.refresh_token

    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=session.refresh_token))

    # Replaying the stale token looks like theft, so it also revokes the
    # rotated token that replaced it (see test_refresh_reuse_revokes_every_
    # session_for_the_user for the full guarantee).
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=rotated.refresh_token))


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_every_session_for_the_user(db):
    """Replaying an already-rotated refresh token looks like theft — the fix
    under review must kill *all* of that user's sessions, not just deny the
    one replayed request."""
    first = await _register(db, email="reuse@example.com")

    # A second, independent session for the same user (e.g. a second device).
    second = await auth_service.login(
        db, LoginRequest(email="reuse@example.com", password="Secret123x")
    )

    rotated = await auth_service.refresh(db, RefreshRequest(refreshToken=first.refresh_token))

    # Replay the now-stale first token — this must be rejected...
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=first.refresh_token))

    # ...and, because that looked like theft, the *other* session (and even
    # the freshly-rotated one) must also have been revoked.
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=second.refresh_token))
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=rotated.refresh_token))


@pytest.mark.asyncio
async def test_logout_revokes_the_session(db):
    session = await _register(db, email="logout@example.com")

    await auth_service.logout(db, LogoutRequest(refreshToken=session.refresh_token))

    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=session.refresh_token))


@pytest.mark.asyncio
async def test_get_me_flattens_owner_permissions_to_full_catalog(db):
    from app.db.seed import all_permission_names

    result = await _register(db, email="me@example.com")
    current = CurrentUser(id=result.user.id, company_id=result.user.company_id, role="owner")

    me = await auth_service.get_me(db, current)
    assert set(me.permissions) == set(all_permission_names())


@pytest.mark.asyncio
async def test_verify_email_marks_user_verified_and_token_single_use(db):
    from app.core.security import generate_opaque_token, hash_opaque_token
    from app.models.enums import AuthTokenPurpose

    result = await _register(db, email="verify@example.com")

    # `register` already minted + emailed a verification token for this
    # user; mint a second one here so the test controls the raw value
    # (only the hash is ever persisted, by design — see AuthToken docstring).
    raw = generate_opaque_token()
    db.add(
        AuthToken(
            user_id=result.user.id,
            purpose=AuthTokenPurpose.EMAIL_VERIFICATION,
            token_hash=hash_opaque_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
    )
    await db.flush()

    await auth_service.verify_email(db, VerifyEmailRequest(token=raw))

    user = (await db.execute(select(User).where(User.id == result.user.id))).scalar_one()
    assert user.email_verified is True

    with pytest.raises(ValidationError):
        await auth_service.verify_email(db, VerifyEmailRequest(token=raw))


@pytest.mark.asyncio
async def test_forgot_password_is_silent_for_unknown_email(db):
    # Must not raise / must not reveal existence either way.
    await auth_service.forgot_password(db, ForgotPasswordRequest(email="nobody@example.com"))


@pytest.mark.asyncio
async def test_reset_password_updates_credential_and_revokes_sessions(db):
    from app.core.security import generate_opaque_token, hash_opaque_token
    from app.models.enums import AuthTokenPurpose

    result = await _register(db, email="reset@example.com", password="OldPassword1")

    raw = generate_opaque_token()
    db.add(
        AuthToken(
            user_id=result.user.id,
            purpose=AuthTokenPurpose.PASSWORD_RESET,
            token_hash=hash_opaque_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    await db.flush()

    await auth_service.reset_password(db, ResetPasswordRequest(token=raw, password="NewPassword1"))

    with pytest.raises(UnauthorizedError):
        await auth_service.login(db, LoginRequest(email="reset@example.com", password="OldPassword1"))

    ok = await auth_service.login(db, LoginRequest(email="reset@example.com", password="NewPassword1"))
    assert ok.user.email == "reset@example.com"

    # the original session (pre-reset) must now be revoked
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(db, RefreshRequest(refreshToken=result.refresh_token))
