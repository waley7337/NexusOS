"""Authentication API registration.

The full authentication service layer is implemented in a later milestone. These
routes exist now so middleware, dependency injection, OpenAPI, and router wiring
can be validated without pretending unfinished workflows are complete.
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser, get_current_user
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=1024)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=4096)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=16, max_length=4096)
    password: str = Field(min_length=8, max_length=1024)


def _not_implemented(workflow: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content=ApiResponse.fail(
            message=f"{workflow} is not implemented yet.",
            errors=[{"code": "auth_not_implemented"}],
        ).model_dump(),
    )


@router.post("/login", summary="Authenticate user", response_model=ApiResponse[dict])
async def login(_payload: LoginRequest) -> Any:
    return _not_implemented("Login")


@router.post("/refresh", summary="Refresh access token", response_model=ApiResponse[dict])
async def refresh_token(_payload: RefreshTokenRequest) -> Any:
    return _not_implemented("Token refresh")


@router.post("/logout", summary="Logout user", response_model=ApiResponse[dict])
async def logout() -> Any:
    return _not_implemented("Logout")


@router.post(
    "/forgot-password",
    summary="Request password reset",
    response_model=ApiResponse[dict],
)
async def forgot_password(_payload: PasswordResetRequest) -> Any:
    return _not_implemented("Password reset request")


@router.post(
    "/reset-password",
    summary="Confirm password reset",
    response_model=ApiResponse[dict],
)
async def reset_password(_payload: PasswordResetConfirmRequest) -> Any:
    return _not_implemented("Password reset")


@router.get("/me", summary="Get current user", response_model=ApiResponse[dict])
async def me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[dict[str, str]]:
    return ApiResponse.ok(
        data={
            "id": str(current_user.id),
            "company_id": str(current_user.company_id),
            "role": current_user.role,
        },
        message="Current user resolved.",
    )
