"""Settings API — company profile read/update and user profile read.

Permissions:
  settings.view   — GET /settings/company, GET /settings/me
  settings.manage — PATCH /settings/company

Only fields that belong in persistent database storage are exposed here.
Infrastructure secrets (DATABASE_URL, JWT_SECRET, etc.) are never readable
or writable through this endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.company import Company
from app.schemas.base import CamelModel
from app.schemas.response import ApiResponse
from app.services import audit_service
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
import uuid

router = APIRouter(prefix="/settings", tags=["Settings"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_EDITABLE_FIELDS = frozenset({
    "name", "industry", "website", "phone", "email", "timezone", "currency",
    "logo_url",
})


class CompanySettingsResponse(CamelModel):
    id: uuid.UUID
    name: str
    slug: str
    industry: str | None = None
    website: str | None = None
    phone: str | None = None
    email: str | None = None
    timezone: str
    currency: str
    logo_url: str | None = Field(default=None, alias="logoUrl")


class CompanySettingsUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = None
    timezone: str | None = Field(default=None, max_length=64)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    logo_url: str | None = Field(default=None, alias="logoUrl", max_length=500)


def _company_response(company: Company) -> CompanySettingsResponse:
    return CompanySettingsResponse.model_validate(company)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get(
    "/company",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_company_settings(
    db: DbSession, user: ActiveUser,
) -> ApiResponse[CompanySettingsResponse]:
    from sqlalchemy import select
    company = (
        await db.execute(select(Company).where(Company.id == user.company_id))
    ).scalar_one()
    return ApiResponse.ok(data=_company_response(company))


@router.patch(
    "/company",
    dependencies=[Depends(require_permission("settings.manage"))],
)
async def update_company_settings(
    payload: CompanySettingsUpdate,
    db: DbSession,
    user: ActiveUser,
    request: Request,
) -> ApiResponse[CompanySettingsResponse]:
    from sqlalchemy import select

    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    company = (
        await db.execute(select(Company).where(Company.id == user.company_id).with_for_update())
    ).scalar_one()

    old_snapshot = {k: getattr(company, k) for k in values if k in _EDITABLE_FIELDS}
    for field, value in values.items():
        if field in _EDITABLE_FIELDS:
            setattr(company, field, value)

    await db.flush()
    await db.refresh(company)

    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="company.settings_updated", entity="companies", entity_id=company.id,
        old_values={k: str(v) if v is not None else None for k, v in old_snapshot.items()},
        new_values={k: str(values[k]) if values[k] is not None else None for k in old_snapshot},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(data=_company_response(company), message="Settings updated.")
