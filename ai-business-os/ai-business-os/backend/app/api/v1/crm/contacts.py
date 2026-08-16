"""Contacts API — tenant-scoped CRM people (Part 06.4).

Contacts belong to Customers (required). Customer FK validation is
application-level (tenant-scoped lookup) in addition to the composite
tenant FK on the model. Soft archive only — never `hard_delete`.
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
from app.dependencies.crm import ContactRepo
from app.models.crm import Contact
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.crm import ContactRepository
from app.schemas.crm import ContactCreate, ContactResponse, ContactUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/contacts", tags=["CRM Contacts"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_AUDIT_FIELDS = (
    "customer_id",
    "first_name",
    "last_name",
    "position",
    "email",
    "phone",
    "linkedin",
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
    return value


def _snapshot(contact: Contact, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(contact, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("contacts.read"))],
)
async def list_contacts(
    repo: ContactRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query()] = None,
    customer_id: Annotated[uuid.UUID | None, Query(alias="customerId")] = None,
) -> ApiResponse[Paginated[ContactResponse]]:
    page, page_size = ContactRepository._clamp_pagination(page, page_size)
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
        customer_id=customer_id,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[ContactResponse.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("contacts.create"))],
)
async def create_contact(
    payload: ContactCreate,
    repo: ContactRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ContactResponse]:
    data = payload.model_dump()
    await repo.ensure_customer_in_tenant(data["customer_id"])

    created = await repo.create(Contact(**data))
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="contact.created",
        entity="contacts",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=ContactResponse.model_validate(created),
        message="Contact created.",
    )


@router.get(
    "/{contact_id}",
    dependencies=[Depends(require_permission("contacts.read"))],
)
async def get_contact(
    contact_id: uuid.UUID,
    repo: ContactRepo,
) -> ApiResponse[ContactResponse]:
    contact = await repo.get(contact_id)
    return ApiResponse.ok(data=ContactResponse.model_validate(contact))


@router.patch(
    "/{contact_id}",
    dependencies=[Depends(require_permission("contacts.update"))],
)
async def update_contact(
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    repo: ContactRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ContactResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    if "customer_id" in values and values["customer_id"] is not None:
        await repo.ensure_customer_in_tenant(values["customer_id"])

    existing = await repo.get(contact_id)
    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(contact_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="contact.updated",
        entity="contacts",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=ContactResponse.model_validate(updated),
        message="Contact updated.",
    )


@router.delete(
    "/{contact_id}",
    dependencies=[Depends(require_permission("contacts.delete"))],
)
async def archive_contact(
    contact_id: uuid.UUID,
    repo: ContactRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(contact_id)
    snapshot = _snapshot(
        existing, ("customer_id", "first_name", "last_name", "email")
    )
    await repo.soft_delete(contact_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="contact.archived",
        entity="contacts",
        entity_id=contact_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Contact archived.")
