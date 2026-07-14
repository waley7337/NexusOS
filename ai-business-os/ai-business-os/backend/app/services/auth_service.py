"""Auth business logic — register, login, refresh, logout, me, forgot/reset,
verify-email.

Kept as plain async functions taking `db: AsyncSession` (mirrors
`db/seed.py`'s style) rather than a stateful class: nothing here needs
per-instance state, and `AuthService` would just be a namespace around
`self.db`. Repositories are used where a query is genuinely tenant-scoped
list/CRUD (`BaseRepository`); the auth-only concerns (session issuance,
token consumption, cross-tenant email lookup) are direct queries, since
`BaseRepository` intentionally refuses to query without tenant context and
login *is* the one place that must look across tenants (see database.md:
"the same person can belong to two tenants").
"""
import re
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError, ValidationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from app.db.seed import DEFAULT_ROLES, expand
from app.dependencies.auth import CurrentUser
from app.models import AuthToken, Company, Permission, Role, Session, User
from app.models.enums import AuthTokenPurpose, UserStatus
from app.schemas.auth import (
    AuthSessionResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenPair,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.email_service import email_service

logger = structlog.get_logger("app.auth")

EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

# Generic message on every forgot-password call — never confirms whether an
# account exists (enumeration protection).
FORGOT_PASSWORD_ACK = "If an account exists for that email, a reset link has been sent."


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "company"


async def _unique_slug(db: AsyncSession, base_name: str) -> str:
    base = _slugify(base_name)
    slug = base
    suffix = 0
    while (await db.execute(select(Company.id).where(Company.slug == slug))).scalar_one_or_none():
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug


async def _bootstrap_company_roles(db: AsyncSession, company_id: uuid.UUID) -> dict[str, Role]:
    """Creates the 5 system roles for a new tenant with their permission
    grants, per the Part 3 seed catalog (`DEFAULT_ROLES`)."""
    catalog = {p.name: p for p in (await db.execute(select(Permission))).scalars().all()}

    roles: dict[str, Role] = {}
    for role_name, pattern in DEFAULT_ROLES.items():
        role = Role(company_id=company_id, name=role_name, is_system=True)
        role.permissions = [catalog[name] for name in expand(pattern) if name in catalog]
        db.add(role)
        roles[role_name] = role
    await db.flush()
    return roles


async def _flatten_permissions(db: AsyncSession, user: User) -> list[str]:
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    hydrated = (await db.execute(stmt)).scalar_one()
    names = {perm.name for role in hydrated.roles for perm in role.permissions}
    return sorted(names)


def _primary_role_name(user: User) -> str:
    return user.roles[0].name.lower() if user.roles else "viewer"


def _to_user_response(user: User, company: Company) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        fullName=user.full_name,
        role=_primary_role_name(user),
        companyId=user.company_id,
        companyName=company.name,
        emailVerified=user.email_verified,
    )


async def _issue_session(db: AsyncSession, user: User) -> TokenPair:
    access = create_access_token(str(user.id), str(user.company_id), _primary_role_name(user))
    refresh = create_refresh_token(str(user.id))
    payload = decode_token(refresh, expected_type="refresh")
    db.add(
        Session(
            user_id=user.id,
            jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
        )
    )
    await db.flush()
    return TokenPair(accessToken=access, refreshToken=refresh)


async def _revoke_all_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    active = (
        await db.execute(select(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None)))
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for s in active:
        s.revoked_at = now
    await db.flush()


async def _get_user_with_relations(db: AsyncSession, user_id: uuid.UUID) -> User:
    stmt = (
        select(User)
        .where(User.id == user_id, User.deleted_at.is_(None))
        .options(selectinload(User.roles), selectinload(User.company))
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found.")
    return user


# --------------------------------------------------------------------------- #
# Public operations
# --------------------------------------------------------------------------- #

async def register(db: AsyncSession, data: RegisterRequest) -> AuthSessionResponse:
    slug = await _unique_slug(db, data.company_name)
    company = Company(name=data.company_name, slug=slug, email=str(data.email))
    db.add(company)
    await db.flush()

    roles = await _bootstrap_company_roles(db, company.id)

    user = User(
        company_id=company.id,
        first_name=data.first_name,
        last_name=data.last_name,
        email=str(data.email),
        password_hash=hash_password(data.password),
        status=UserStatus.ACTIVE,
    )
    user.roles = [roles["Owner"]]
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        # Only the (company_id, email) unique constraint can fail here —
        # anything else is a real bug and must not be masked as a conflict.
        await db.rollback()
        raise ConflictError("An account with that email already exists.") from exc

    verification_token = generate_opaque_token()
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=AuthTokenPurpose.EMAIL_VERIFICATION,
            token_hash=hash_opaque_token(verification_token),
            expires_at=datetime.now(timezone.utc) + EMAIL_VERIFICATION_TTL,
        )
    )
    await email_service.send_verification_email(to=user.email, token=verification_token)

    tokens = await _issue_session(db, user)
    logger.info("auth.register", user_id=str(user.id), company_id=str(company.id))
    return AuthSessionResponse(
        accessToken=tokens.access_token,
        refreshToken=tokens.refresh_token,
        user=_to_user_response(user, company),
    )


async def login(db: AsyncSession, data: LoginRequest) -> AuthSessionResponse:
    # No tenant context yet — deliberately queries across companies (the one
    # legitimate exception to BaseRepository's fail-closed tenant scoping).
    stmt = (
        select(User)
        .where(User.email == str(data.email), User.deleted_at.is_(None), User.is_active.is_(True))
        .options(selectinload(User.roles), selectinload(User.company))
    )
    candidates = (await db.execute(stmt)).scalars().all()

    user = next(
        (u for u in candidates if u.password_hash and verify_password(data.password, u.password_hash)),
        None,
    )
    if user is None:
        raise UnauthorizedError("Incorrect email or password.")
    if user.status == UserStatus.SUSPENDED:
        raise UnauthorizedError("This account has been suspended.")

    user.last_login_at = datetime.now(timezone.utc)
    tokens = await _issue_session(db, user)
    logger.info("auth.login", user_id=str(user.id))
    return AuthSessionResponse(
        accessToken=tokens.access_token,
        refreshToken=tokens.refresh_token,
        user=_to_user_response(user, user.company),
    )


async def refresh(db: AsyncSession, data: RefreshRequest) -> TokenPair:
    try:
        payload = decode_token(data.refresh_token, expected_type="refresh")
    except Exception as exc:  # noqa: BLE001
        raise UnauthorizedError("Invalid or expired refresh token.") from exc

    jti = payload["jti"]
    session = (
        await db.execute(select(Session).where(Session.jti == jti))
    ).scalar_one_or_none()
    if session is None:
        raise UnauthorizedError("Invalid or expired refresh token.")

    if session.revoked_at is not None:
        # This token was already rotated away — a legitimate client only ever
        # holds the *latest* refresh token, so presenting an already-revoked
        # one means it was copied (e.g. stolen). Treat it as compromise: kill
        # every session for this user, not just the replayed one.
        await _revoke_all_sessions(db, session.user_id)
        raise UnauthorizedError("Invalid or expired refresh token.")

    if not session.is_valid:
        raise UnauthorizedError("Invalid or expired refresh token.")

    user = await _get_user_with_relations(db, uuid.UUID(payload["sub"]))

    # Rotate: this token can never be used again, even if the new pair is
    # never claimed (e.g. the response is lost in transit).
    session.revoked_at = datetime.now(timezone.utc)
    await db.flush()

    return await _issue_session(db, user)


async def logout(db: AsyncSession, data: LogoutRequest) -> None:
    try:
        payload = decode_token(data.refresh_token, expected_type="refresh")
    except Exception:  # noqa: BLE001 — logout is idempotent either way
        return
    session = (
        await db.execute(select(Session).where(Session.jti == payload["jti"]))
    ).scalar_one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.flush()


async def get_me(db: AsyncSession, current: CurrentUser) -> MeResponse:
    user = await _get_user_with_relations(db, current.id)
    permissions = await _flatten_permissions(db, user)
    return MeResponse(user=_to_user_response(user, user.company), permissions=permissions)


async def forgot_password(db: AsyncSession, data: ForgotPasswordRequest) -> None:
    stmt = select(User).where(User.email == str(data.email), User.deleted_at.is_(None))
    users = (await db.execute(stmt)).scalars().all()

    for user in users:
        # Invalidate any outstanding reset tokens for this user first, so
        # only the newest link ever works.
        outstanding = (
            await db.execute(
                select(AuthToken).where(
                    AuthToken.user_id == user.id,
                    AuthToken.purpose == AuthTokenPurpose.PASSWORD_RESET,
                    AuthToken.used_at.is_(None),
                )
            )
        ).scalars().all()
        for stale in outstanding:
            stale.used_at = datetime.now(timezone.utc)

        token = generate_opaque_token()
        db.add(
            AuthToken(
                user_id=user.id,
                purpose=AuthTokenPurpose.PASSWORD_RESET,
                token_hash=hash_opaque_token(token),
                expires_at=datetime.now(timezone.utc) + PASSWORD_RESET_TTL,
            )
        )
        await email_service.send_password_reset_email(to=user.email, token=token)

    await db.flush()
    # Always succeeds from the caller's point of view — see FORGOT_PASSWORD_ACK.


async def reset_password(db: AsyncSession, data: ResetPasswordRequest) -> None:
    token_row = await _consume_token(db, data.token, AuthTokenPurpose.PASSWORD_RESET)
    user = await _get_user_with_relations(db, token_row.user_id)
    user.password_hash = hash_password(data.password)

    # A password reset invalidates every existing session — the old
    # password's sessions must not outlive the credential that created them.
    await _revoke_all_sessions(db, user.id)
    logger.info("auth.password_reset", user_id=str(user.id))


async def verify_email(db: AsyncSession, data: VerifyEmailRequest) -> None:
    token_row = await _consume_token(db, data.token, AuthTokenPurpose.EMAIL_VERIFICATION)
    user = await _get_user_with_relations(db, token_row.user_id)
    user.email_verified = True
    await db.flush()
    logger.info("auth.email_verified", user_id=str(user.id))


async def _consume_token(db: AsyncSession, raw_token: str, purpose: AuthTokenPurpose) -> AuthToken:
    token_hash = hash_opaque_token(raw_token)
    row = (
        await db.execute(
            select(AuthToken).where(AuthToken.token_hash == token_hash, AuthToken.purpose == purpose)
        )
    ).scalar_one_or_none()
    if row is None or not row.is_valid:
        raise ValidationError("This link is invalid or has expired.")
    row.used_at = datetime.now(timezone.utc)
    await db.flush()
    return row
