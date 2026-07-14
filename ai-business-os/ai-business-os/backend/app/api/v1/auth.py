"""`/auth/*` — register, login, refresh, logout, me, forgot/reset, verify.

Thin by design: request → service → `ApiResponse.ok(...)`. All business logic
(tenant bootstrap, token issuance/rotation, RBAC flattening) lives in
`app.services.auth_service`.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import CurrentUser, get_current_user
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


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DbSession) -> ApiResponse[AuthSessionResponse]:
    result = await auth_service.register(db, payload)
    return ApiResponse.ok(data=result, message="Account created.")


@router.post("/login")
async def login(payload: LoginRequest, db: DbSession) -> ApiResponse[AuthSessionResponse]:
    result = await auth_service.login(db, payload)
    return ApiResponse.ok(data=result, message="Signed in.")


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: DbSession) -> ApiResponse[TokenPair]:
    result = await auth_service.refresh(db, payload)
    return ApiResponse.ok(data=result)


@router.post("/logout")
async def logout(payload: LogoutRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.logout(db, payload)
    return ApiResponse.ok(message="Signed out.")


@router.get("/me")
async def me(
    db: DbSession, current_user: Annotated[CurrentUser, Depends(get_current_user)]
) -> ApiResponse[MeResponse]:
    result = await auth_service.get_me(db, current_user)
    return ApiResponse.ok(data=result)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.forgot_password(db, payload)
    return ApiResponse.ok(message=auth_service.FORGOT_PASSWORD_ACK)


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.reset_password(db, payload)
    return ApiResponse.ok(message="Password updated. Sign in with your new password.")


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: DbSession) -> ApiResponse[None]:
    await auth_service.verify_email(db, payload)
    return ApiResponse.ok(message="Email verified.")
