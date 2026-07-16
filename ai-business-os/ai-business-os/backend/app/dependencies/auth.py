"""Authentication & authorization dependencies.

`CurrentUser` is the single source of truth for identity + tenant on a
request. Repositories receive `current_user.company_id`, which makes tenant
scoping automatic everywhere.

Two authentication dependencies exist, deliberately:

  * `get_current_user`  — decodes and validates the JWT only. Cheap, no DB
    hit. Proves "this is a validly signed, unexpired access token", nothing
    more. Its `role` field is a *token claim*, i.e. it can be up to
    ACCESS_TOKEN_EXPIRE_MINUTES stale relative to the database.

  * `get_current_active_user` — the authoritative dependency for anything
    that makes an authorization decision. It re-derives role and
    permissions from the database on every call (never trusts the token's
    embedded role/permissions), and fails closed if the user has been
    suspended/deactivated/deleted or the tenant has been deactivated/deleted
    since the token was issued. This closes the "stale JWT" privilege
    window: a suspended user's existing access token stops working on the
    very next permission-checked request, not just after it expires.

`require_roles` / `require_permission` both build on
`get_current_active_user`, so every route-level guard gets the fresh-from-DB
check for free.
"""
import uuid
from dataclasses import dataclass, field
from typing import Annotated

import jwt as pyjwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserStatus
from app.models.user import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    company_id: uuid.UUID
    role: str
    # Populated only by `get_current_active_user`. Empty for the token-only
    # dependency — never used for allow decisions in that path.
    permissions: frozenset[str] = field(default_factory=frozenset)


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> CurrentUser:
    if credentials is None:
        raise UnauthorizedError()
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
        return CurrentUser(
            id=uuid.UUID(payload["sub"]),
            company_id=uuid.UUID(payload["company_id"]),
            role=payload["role"],
        )
    except (pyjwt.PyJWTError, KeyError, ValueError) as exc:
        raise UnauthorizedError("Invalid or expired token.") from exc


async def get_current_active_user(
    token_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CurrentUser:
    """Re-validate identity against the database and hydrate real-time role
    + permissions. Never trusts `token_user.role`/`company_id` for anything
    beyond locating the row by primary key — every authorization-relevant
    value returned here comes fresh from the database on this request.

    Fails closed (401) if: the user no longer exists, is soft-deleted, is
    inactive, is suspended, or belongs to a tenant that is deactivated or
    soft-deleted.
    """
    stmt = (
        select(User)
        .where(User.id == token_user.id, User.deleted_at.is_(None))
        .options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.company),
        )
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user is None or not user.is_active or user.status == UserStatus.SUSPENDED:
        raise UnauthorizedError("Account is no longer active.")

    company = user.company
    if company is None or company.deleted_at is not None or not company.is_active:
        raise UnauthorizedError("Company is no longer active.")

    permissions = frozenset(
        perm.name for role in user.roles for perm in role.permissions
    )
    # `User.roles` is ordered by `Role.name` (see `models/user.py`, SEC-002
    # remediation) so `roles[0]` is deterministic for a multi-role user
    # instead of an unspecified DB/relationship-load order.
    role_name = user.roles[0].name.lower() if user.roles else "viewer"

    return CurrentUser(
        id=user.id,
        company_id=user.company_id,  # from the DB row, never the token claim
        role=role_name,
        permissions=permissions,
    )


def require_roles(*roles: str):
    """Route-level RBAC guard for coarse, role-name checks (e.g. owner-only
    operations). Prefer `require_permission` for anything else — it is more
    precise and doesn't hard-code role names into route wiring.

        @router.delete("/{id}", dependencies=[Depends(require_roles("owner", "admin"))])
    """

    async def checker(
        user: Annotated[CurrentUser, Depends(get_current_active_user)],
    ) -> CurrentUser:
        if user.role not in roles:
            raise ForbiddenError()
        return user

    return checker


def require_permission(*permissions: str):
    """Route-level permission guard — deny by default. The caller must hold
    *every* listed permission (AND semantics); pass multiple `Depends(...)`
    if you need an OR relationship across unrelated permission sets.

    Missing/unknown permissions always deny, even for a caller who holds
    other, unrelated permissions — there is no implicit wildcard match here
    (wildcard expansion happens once, at role-assignment time, in
    `app/db/seed.py`).

        @router.get("/", dependencies=[Depends(require_permission("customers.read"))])
    """

    async def checker(
        user: Annotated[CurrentUser, Depends(get_current_active_user)],
    ) -> CurrentUser:
        missing = set(permissions) - user.permissions
        if missing:
            raise ForbiddenError()
        return user

    return checker
