"""Customer notes API — nested under customers (Part 06.9).

Polymorphic timeline notes distinct from the inline ``Customer.notes`` field.
Reuses ``customers.*`` permissions. Soft archive only — never ``hard_delete``.
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
from app.dependencies.crm import CustomerNoteRepo
from app.models.crm import CustomerNote
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.crm import CustomerNoteRepository
from app.schemas.crm import CustomerNoteCreate, CustomerNoteResponse, CustomerNoteUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/{customer_id}/notes", tags=["CRM Customer Notes"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_AUDIT_FIELDS = ("customer_id", "author_id", "content")


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


def _snapshot(note: CustomerNote, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(note, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("customers.read"))],
)
async def list_customer_notes(
    customer_id: uuid.UUID,
    repo: CustomerNoteRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = True,
) -> ApiResponse[Paginated[CustomerNoteResponse]]:
    page, page_size = CustomerNoteRepository._clamp_pagination(page, page_size)
    items, total = await repo.list_for_customer(
        customer_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[CustomerNoteResponse.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("customers.update"))],
)
async def create_customer_note(
    customer_id: uuid.UUID,
    payload: CustomerNoteCreate,
    repo: CustomerNoteRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[CustomerNoteResponse]:
    await repo.ensure_customer_in_tenant(customer_id)
    created = await repo.create(
        CustomerNote(
            customer_id=customer_id,
            author_id=user.id,
            content=payload.content,
        )
    )
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer_note.created",
        entity="customer_notes",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=CustomerNoteResponse.model_validate(created),
        message="Note added.",
    )


@router.get(
    "/{note_id}",
    dependencies=[Depends(require_permission("customers.read"))],
)
async def get_customer_note(
    customer_id: uuid.UUID,
    note_id: uuid.UUID,
    repo: CustomerNoteRepo,
) -> ApiResponse[CustomerNoteResponse]:
    note = await repo.get_for_customer(customer_id, note_id)
    return ApiResponse.ok(data=CustomerNoteResponse.model_validate(note))


@router.patch(
    "/{note_id}",
    dependencies=[Depends(require_permission("customers.update"))],
)
async def update_customer_note(
    customer_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: CustomerNoteUpdate,
    repo: CustomerNoteRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[CustomerNoteResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get_for_customer(customer_id, note_id)
    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(note_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer_note.updated",
        entity="customer_notes",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=CustomerNoteResponse.model_validate(updated),
        message="Note updated.",
    )


@router.delete(
    "/{note_id}",
    dependencies=[Depends(require_permission("customers.delete"))],
)
async def archive_customer_note(
    customer_id: uuid.UUID,
    note_id: uuid.UUID,
    repo: CustomerNoteRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get_for_customer(customer_id, note_id)
    snapshot = _snapshot(existing, _AUDIT_FIELDS)
    await repo.soft_delete(note_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="customer_note.archived",
        entity="customer_notes",
        entity_id=note_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Note archived.")
