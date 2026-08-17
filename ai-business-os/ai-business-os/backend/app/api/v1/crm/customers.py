"""Customers API — first live tenant-scoped CRM CRUD (Part 06.2).

Router → CustomerRepository. Mutations share the request transaction with
`audit_service.record` (flush-only). No business-activity timeline here
(06.11). Soft archive only — never `hard_delete`.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.dependencies.crm import CustomerRepo
from app.models.crm import Customer
from app.models.enums import CustomerStatus
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.crm import CustomerRepository
from app.schemas.crm import CustomerCreate, CustomerResponse, CustomerUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

from app.api.v1.crm import customer_notes

router = APIRouter(prefix="/customers", tags=["CRM Customers"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_AUDIT_FIELDS = (
    "company_name",
    "industry",
    "website",
    "email",
    "phone",
    "address",
    "city",
    "country",
    "notes",
    "owner_id",
    "status",
    "source",
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
    return value


def _snapshot(customer: Customer, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(customer, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("customers.read"))],
)
async def list_customers(
    repo: CustomerRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query()] = None,
    status_filter: Annotated[
        CustomerStatus | None, Query(alias="status")
    ] = None,
    owner_id: Annotated[uuid.UUID | None, Query(alias="ownerId")] = None,
) -> ApiResponse[Paginated[CustomerResponse]]:
    page, page_size = CustomerRepository._clamp_pagination(page, page_size)
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
        status=status_filter,
        owner_id=owner_id,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[CustomerResponse.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("customers.create"))],
)
async def create_customer(
    payload: CustomerCreate,
    repo: CustomerRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[CustomerResponse]:
    data = payload.model_dump()
    owner_id = data.get("owner_id")
    if owner_id is not None:
        await repo.ensure_owner_in_tenant(owner_id)

    created = await repo.create(Customer(**data))
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer.created",
        entity="customers",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=CustomerResponse.model_validate(created),
        message="Customer created.",
    )


@router.get(
    "/{customer_id}",
    dependencies=[Depends(require_permission("customers.read"))],
)
async def get_customer(
    customer_id: uuid.UUID,
    repo: CustomerRepo,
) -> ApiResponse[CustomerResponse]:
    customer = await repo.get(customer_id)
    return ApiResponse.ok(data=CustomerResponse.model_validate(customer))


@router.patch(
    "/{customer_id}",
    dependencies=[Depends(require_permission("customers.update"))],
)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    repo: CustomerRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[CustomerResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    if "owner_id" in values and values["owner_id"] is not None:
        await repo.ensure_owner_in_tenant(values["owner_id"])

    existing = await repo.get(customer_id)
    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(customer_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer.updated",
        entity="customers",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=CustomerResponse.model_validate(updated),
        message="Customer updated.",
    )


@router.delete(
    "/{customer_id}",
    dependencies=[Depends(require_permission("customers.delete"))],
)
async def archive_customer(
    customer_id: uuid.UUID,
    repo: CustomerRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(customer_id)
    snapshot = _snapshot(existing, ("company_name", "status", "owner_id"))
    await repo.soft_delete(customer_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer.archived",
        entity="customers",
        entity_id=customer_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Customer archived.")


router.include_router(customer_notes.router)
