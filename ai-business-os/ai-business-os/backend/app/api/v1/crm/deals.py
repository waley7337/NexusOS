"""Deals API — tenant-scoped commercial outcomes (Part 06.8).

Deals belong to Leads (required, one active Deal per Lead via partial unique
index). Lead FK validation is application-level in addition to the composite
tenant FK. Soft archive only — never `hard_delete`.

Does not convert Leads, auto-create Deals on pipeline WON, or touch
Notes/Meetings/Activities/RLS.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.dependencies.crm import DealRepo
from app.models.crm import Deal
from app.models.enums import DealStatus
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.crm import DealRepository
from app.schemas.crm import DealCreate, DealResponse, DealUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/deals", tags=["CRM Deals"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_AUDIT_FIELDS = (
    "lead_id",
    "value",
    "currency",
    "status",
    "won_at",
    "lost_reason",
)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


def _serialize_audit_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _snapshot(deal: Deal, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(deal, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("deals.read"))],
)
async def list_deals(
    repo: DealRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    lead_id: Annotated[uuid.UUID | None, Query(alias="leadId")] = None,
    deal_status: Annotated[
        DealStatus | None, Query(alias="status")
    ] = None,
) -> ApiResponse[Paginated[DealResponse]]:
    page, page_size = DealRepository._clamp_pagination(page, page_size)
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        lead_id=lead_id,
        status=deal_status,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[DealResponse.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("deals.create"))],
)
async def create_deal(
    payload: DealCreate,
    repo: DealRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[DealResponse]:
    data = payload.model_dump()
    await repo.ensure_lead_in_tenant(data["lead_id"])
    await repo.ensure_lead_available_for_deal(data["lead_id"])

    try:
        created = await repo.create(Deal(**data))
    except IntegrityError as exc:
        await db.rollback()
        raise ValidationError("This lead already has an active deal.") from exc

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="deal.created",
        entity="deals",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=DealResponse.model_validate(created),
        message="Deal created.",
    )


@router.get(
    "/{deal_id}",
    dependencies=[Depends(require_permission("deals.read"))],
)
async def get_deal(
    deal_id: uuid.UUID,
    repo: DealRepo,
) -> ApiResponse[DealResponse]:
    deal = await repo.get(deal_id)
    return ApiResponse.ok(data=DealResponse.model_validate(deal))


@router.patch(
    "/{deal_id}",
    dependencies=[Depends(require_permission("deals.update"))],
)
async def update_deal(
    deal_id: uuid.UUID,
    payload: DealUpdate,
    repo: DealRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[DealResponse]:
    # DealUpdate intentionally omits lead_id — lead reassignment is not
    # part of the Deal contract (create binds Deal→Lead once).
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get(deal_id)
    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(deal_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="deal.updated",
        entity="deals",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=DealResponse.model_validate(updated),
        message="Deal updated.",
    )


@router.delete(
    "/{deal_id}",
    dependencies=[Depends(require_permission("deals.delete"))],
)
async def archive_deal(
    deal_id: uuid.UUID,
    repo: DealRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(deal_id)
    snapshot = _snapshot(existing, ("lead_id", "value", "currency", "status"))
    await repo.soft_delete(deal_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="deal.archived",
        entity="deals",
        entity_id=deal_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Deal archived.")
