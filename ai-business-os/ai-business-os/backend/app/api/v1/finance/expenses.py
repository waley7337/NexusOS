"""Expenses API — tenant-scoped Finance CRUD.

Permissions: expenses.read (list/detail), expenses.create / update / delete.
``paid_by`` is validated in-tenant when provided; soft-delete via BaseRepository.
Mutations share the request transaction with ``audit_service.record`` (flush-only).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.finance import ActiveUser, DbSession, ExpenseRepo
from app.models.finance import Expense
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.finance import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    expense_to_response,
)
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/expenses", tags=["Finance Expenses"])

_AUDIT_FIELDS = ("category", "amount", "currency", "description", "date", "paid_by")


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


def _serialize_audit_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)


def _snapshot(expense: Expense, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(expense, name)) for name in fields}


@router.get(
    "",
    dependencies=[Depends(require_permission("expenses.read"))],
)
async def list_expenses(
    repo: ExpenseRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    category: Annotated[str | None, Query(max_length=100)] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    date_from: Annotated[date | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[date | None, Query(alias="dateTo")] = None,
) -> ApiResponse[Paginated[ExpenseResponse]]:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise ValidationError("dateFrom must be on or before dateTo.")

    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        category=category,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[expense_to_response(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("expenses.create"))],
)
async def create_expense(
    payload: ExpenseCreate,
    repo: ExpenseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ExpenseResponse]:
    data = payload.model_dump()
    paid_by = data.get("paid_by")
    if paid_by is not None:
        await repo.ensure_paid_by_in_tenant(paid_by)

    try:
        created = await repo.create(Expense(**data))
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "Could not create expense. Check that paidBy refers to a user in your company."
        )

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="expense.created",
        entity="expenses",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=expense_to_response(created),
        message="Expense created.",
    )


@router.get(
    "/{expense_id}",
    dependencies=[Depends(require_permission("expenses.read"))],
)
async def get_expense(
    expense_id: uuid.UUID,
    repo: ExpenseRepo,
) -> ApiResponse[ExpenseResponse]:
    expense = await repo.get(expense_id)
    return ApiResponse.ok(data=expense_to_response(expense))


@router.patch(
    "/{expense_id}",
    dependencies=[Depends(require_permission("expenses.update"))],
)
async def update_expense(
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    repo: ExpenseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ExpenseResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    if "paid_by" in values and values["paid_by"] is not None:
        await repo.ensure_paid_by_in_tenant(values["paid_by"])

    existing = await repo.get(expense_id)
    old_values = _snapshot(existing, list(values.keys()))

    try:
        updated = await repo.update(expense_id, values)
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "Could not update expense. Check that paidBy refers to a user in your company."
        )

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="expense.updated",
        entity="expenses",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, list(values.keys())),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=expense_to_response(updated),
        message="Expense updated.",
    )


@router.delete(
    "/{expense_id}",
    dependencies=[Depends(require_permission("expenses.delete"))],
)
async def delete_expense(
    expense_id: uuid.UUID,
    repo: ExpenseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(expense_id)
    await repo.soft_delete(expense_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="expense.deleted",
        entity="expenses",
        entity_id=expense_id,
        old_values=_snapshot(existing, _AUDIT_FIELDS),
        new_values={"deleted": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Expense deleted.")
