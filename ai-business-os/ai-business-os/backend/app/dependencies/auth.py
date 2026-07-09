"""Authentication & authorization dependencies.

`CurrentUser` is the single source of truth for identity + tenant on a
request. Repositories receive `current_user.company_id`, which makes tenant
scoping automatic everywhere.
"""
import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt as pyjwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: uuid.UUID
    company_id: uuid.UUID
    role: str


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


def require_roles(*roles: str):
    """Route-level RBAC guard. Usage:

        @router.delete("/{id}", dependencies=[Depends(require_roles("owner", "admin"))])
    """

    async def checker(
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if user.role not in roles:
            raise ForbiddenError()
        return user

    return checker
