"""Leads API — tenant-scoped CRM pipeline opportunities (Part 06.6).

Leads belong to Customers (required). Customer and assignee FK validation
is application-level (tenant-scoped lookup) in addition to the composite
tenant FK on the model. Soft archive only — never `hard_delete`.

Does not create Deals, convert leads, or touch Notes/Meetings/RLS.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.dependencies.crm import LeadRepo
from app.models.crm import Lead
from app.models.enums import PipelineStage
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.crm import LeadRepository
from app.schemas.crm import LeadCreate, LeadResponse, LeadUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/leads", tags=["CRM Leads"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_AUDIT_FIELDS = (
    "customer_id",
    "pipeline_stage",
    "estimated_value",
    "probability",
    "expected_close_date",
    "assigned_to",
    "notes",
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
    if isinstance(value, date):
        return value.isoformat()
    return value


def _snapshot(lead: Lead, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(lead, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("leads.read"))],
)
async def list_leads(
    repo: LeadRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query()] = None,
    customer_id: Annotated[uuid.UUID | None, Query(alias="customerId")] = None,
    pipeline_stage: Annotated[
        PipelineStage | None, Query(alias="pipelineStage")
    ] = None,
    assigned_to: Annotated[uuid.UUID | None, Query(alias="assignedTo")] = None,
) -> ApiResponse[Paginated[LeadResponse]]:
    page, page_size = LeadRepository._clamp_pagination(page, page_size)
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
        customer_id=customer_id,
        pipeline_stage=pipeline_stage,
        assigned_to=assigned_to,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[LeadResponse.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("leads.create"))],
)
async def create_lead(
    payload: LeadCreate,
    repo: LeadRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeadResponse]:
    data = payload.model_dump()
    await repo.ensure_customer_in_tenant(data["customer_id"])
    assigned_to = data.get("assigned_to")
    if assigned_to is not None:
        await repo.ensure_assignee_in_tenant(assigned_to)

    created = await repo.create(Lead(**data))
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="lead.created",
        entity="leads",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=LeadResponse.model_validate(created),
        message="Lead created.",
    )


@router.get(
    "/{lead_id}",
    dependencies=[Depends(require_permission("leads.read"))],
)
async def get_lead(
    lead_id: uuid.UUID,
    repo: LeadRepo,
) -> ApiResponse[LeadResponse]:
    lead = await repo.get(lead_id)
    return ApiResponse.ok(data=LeadResponse.model_validate(lead))


@router.patch(
    "/{lead_id}",
    dependencies=[Depends(require_permission("leads.update"))],
)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    repo: LeadRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeadResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    if "customer_id" in values and values["customer_id"] is not None:
        await repo.ensure_customer_in_tenant(values["customer_id"])
    if "assigned_to" in values and values["assigned_to"] is not None:
        await repo.ensure_assignee_in_tenant(values["assigned_to"])

    existing = await repo.get(lead_id)
    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(lead_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="lead.updated",
        entity="leads",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=LeadResponse.model_validate(updated),
        message="Lead updated.",
    )


@router.delete(
    "/{lead_id}",
    dependencies=[Depends(require_permission("leads.delete"))],
)
async def archive_lead(
    lead_id: uuid.UUID,
    repo: LeadRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(lead_id)
    snapshot = _snapshot(
        existing, ("customer_id", "pipeline_stage", "estimated_value", "assigned_to")
    )
    await repo.soft_delete(lead_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="lead.archived",
        entity="leads",
        entity_id=lead_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Lead archived.")
