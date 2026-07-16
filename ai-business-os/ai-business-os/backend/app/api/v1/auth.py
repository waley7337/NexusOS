"""`/auth/*` — register, login, refresh, logout, me, forgot/reset, verify.

Thin by design: request → service → `ApiResponse.ok(...)`. All business logic
(tenant bootstrap, token issuance/rotation, RBAC flattening) lives in
`app.services.auth_service`.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.rate_limit import rate_limit
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.db.session import get_db
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
    VerifyEmailRequest,
)
from app.schemas.response import ApiResponse
from app.services import auth_service

router = APIRouter(tags=["Auth"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    """IP + user agent for audit trails — never taken from a client-settable
    security field. The IP goes through the same centralized trusted-proxy
    boundary (`app.core.client_ip`) used by rate limiting and security
    headers, so an audit record reflects the real client behind a
    *configured, trusted* proxy rather than the proxy's own address —
    while still never trusting a forwarded header from an untrusted peer."""
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("auth.register", limit=5))],
)
async def register(payload: RegisterRequest, db: DbSession, request: Request) -> ApiResponse[AuthSessionResponse]:
    ip_address, user_agent = _client_meta(request)
    result = await auth_service.register(db, payload, ip_address=ip_address, user_agent=user_agent)
    return ApiResponse.ok(data=result, message="Account created.")


@router.post("/login", dependencies=[Depends(rate_limit("auth.login", limit=10))])
async def login(payload: LoginRequest, db: DbSession, request: Request) -> ApiResponse[AuthSessionResponse]:
    ip_address, user_agent = _client_meta(request)
    result = await auth_service.login(db, payload, ip_address=ip_address, user_agent=user_agent)
    return ApiResponse.ok(data=result, message="Signed in.")


@router.post("/refresh", dependencies=[Depends(rate_limit("auth.refresh", limit=30))])
async def refresh(payload: RefreshRequest, db: DbSession, request: Request) -> ApiResponse[TokenPair]:
    ip_address, user_agent = _client_meta(request)
    result = await auth_service.refresh(db, payload, ip_address=ip_address, user_agent=user_agent)
    return ApiResponse.ok(data=result)


@router.post("/logout")
async def logout(payload: LogoutRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.logout(db, payload)
    return ApiResponse.ok(message="Signed out.")


@router.get("/me")
async def me(
    db: DbSession,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
) -> ApiResponse[MeResponse]:
    result = await auth_service.get_me(db, current_user)
    return ApiResponse.ok(data=result)


@router.post(
    "/forgot-password",
    dependencies=[Depends(rate_limit("auth.forgot_password", limit=5))],
)
async def forgot_password(payload: ForgotPasswordRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.forgot_password(db, payload)
    return ApiResponse.ok(message=auth_service.FORGOT_PASSWORD_ACK)


@router.post(
    "/reset-password",
    dependencies=[Depends(rate_limit("auth.reset_password", limit=10))],
)
async def reset_password(payload: ResetPasswordRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.reset_password(db, payload)
    return ApiResponse.ok(message="Password updated. Sign in with your new password.")


@router.post(
    "/verify-email",
    dependencies=[Depends(rate_limit("auth.verify_email", limit=10))],
)
async def verify_email(payload: VerifyEmailRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.verify_email(db, payload)
    return ApiResponse.ok(message="Email verified.")
