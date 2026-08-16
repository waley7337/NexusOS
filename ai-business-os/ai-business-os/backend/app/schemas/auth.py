"""Request/response schemas for `/auth/*` — Part 02.

Field names are snake_case in Python, camelCase on the wire (mirrors
`PageMeta` in `schemas/response.py`), matching the frontend's `ApiResponse<T>`
consumers without either side compromising its own naming convention.
"""

import uuid

from pydantic import EmailStr, Field, field_validator

from app.schemas.base import CamelModel


def _password_strength(password: str) -> str:
    """Shared by `RegisterRequest` and `ResetPasswordRequest` — one rule, one
    place to change it, mirrored on the frontend by `passwordRule` in
    `features/auth/schemas/registerSchema.ts`."""
    if password.isdigit() or password.isalpha():
        raise ValueError("Password must contain both letters and numbers.")
    return password


# --- Requests ------------------------------------------------------------


class RegisterRequest(CamelModel):
    company_name: str = Field(
        alias="companyName",
        min_length=2,
        max_length=200,
    )
    first_name: str = Field(
        alias="firstName",
        min_length=1,
        max_length=100,
    )
    last_name: str = Field(
        alias="lastName",
        min_length=1,
        max_length=100,
    )
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    _validate_password = field_validator("password")(_password_strength)


class LoginRequest(CamelModel):
    company_slug: str = Field(
        alias="companySlug",
        min_length=1,
        max_length=80,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(alias="refreshToken")


class LogoutRequest(CamelModel):
    refresh_token: str = Field(alias="refreshToken")


class ForgotPasswordRequest(CamelModel):
    email: EmailStr


class ResetPasswordRequest(CamelModel):
    token: str
    password: str = Field(min_length=8, max_length=128)

    _validate_password = field_validator("password")(_password_strength)


class VerifyEmailRequest(CamelModel):
    token: str


# --- Responses ------------------------------------------------------------


class UserResponse(CamelModel):
    id: uuid.UUID
    email: str
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    full_name: str = Field(alias="fullName")
    role: str
    company_id: uuid.UUID = Field(alias="companyId")
    company_name: str = Field(alias="companyName")
    company_slug: str = Field(alias="companySlug")
    email_verified: bool = Field(alias="emailVerified")


class TokenPair(CamelModel):
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")


class AuthSessionResponse(TokenPair):
    """Login/Register response: tokens + the identity they belong to."""

    user: UserResponse


class MeResponse(CamelModel):
    user: UserResponse
    permissions: list[str]