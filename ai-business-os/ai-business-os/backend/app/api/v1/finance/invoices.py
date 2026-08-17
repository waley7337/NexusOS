"""Invoices API — tenant-scoped Finance CRUD + lifecycle (Part 08.2).

Router → InvoiceRepository. Monetary totals are computed server-side via
``app.payments.money``. Mutations share the request transaction with
``audit_service.record`` (flush-only). Payments API is out of scope.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.finance import ActiveUser, DbSession, InvoiceRepo
from app.models.enums import InvoiceStatus
from app.models.finance import Invoice
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.finance import InvoiceRepository
from app.schemas.finance import InvoiceCreate, InvoiceResponse, InvoiceUpdate, invoice_to_response
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/invoices", tags=["Finance Invoices"])

_AUDIT_FIELDS = (
    "customer_id",
    "invoice_number",
    "issue_date",
    "due_date",
    "status",
    "subtotal",
    "tax",
    "total",
    "currency",
    "sent_at",
    "voided_at",
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
    return str(value)


def _snapshot(invoice: Invoice, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(invoice, name)) for name in fields}


def _serialize_invoice(invoice: Invoice) -> InvoiceResponse:
    amount_paid, outstanding_balance = InvoiceRepository.payment_summary(invoice)
    return invoice_to_response(
        invoice,
        amount_paid=amount_paid,
        outstanding_balance=outstanding_balance,
    )


@router.get(
    "",
    dependencies=[Depends(require_permission("invoices.read"))],
)
async def list_invoices(
    repo: InvoiceRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: InvoiceStatus | None = None,
    customer_id: Annotated[uuid.UUID | None, Query(alias="customerId")] = None,
) -> ApiResponse[Paginated[InvoiceResponse]]:
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
        status=status,
        customer_id=customer_id,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[_serialize_invoice(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
async def create_invoice(
    payload: InvoiceCreate,
    repo: InvoiceRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[InvoiceResponse]:
    items = [item.model_dump() for item in payload.items]
    created = await repo.create_invoice(
        invoice_number=payload.invoice_number,
        customer_id=payload.customer_id,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        currency=payload.currency,
        tax=payload.tax,
        items=items,
    )
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="invoice.created",
        entity="invoices",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=_serialize_invoice(created),
        message="Invoice created.",
    )


@router.get(
    "/{invoice_id}",
    dependencies=[Depends(require_permission("invoices.read"))],
)
async def get_invoice(
    invoice_id: uuid.UUID,
    repo: InvoiceRepo,
) -> ApiResponse[InvoiceResponse]:
    invoice = await repo.get_with_details(invoice_id)
    return ApiResponse.ok(data=_serialize_invoice(invoice))


@router.patch(
    "/{invoice_id}",
    dependencies=[Depends(require_permission("invoices.update"))],
)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    repo: InvoiceRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[InvoiceResponse]:
    values = payload.model_dump(exclude_unset=True)
    items_payload = values.pop("items", None)
    if not values and items_payload is None:
        raise ValidationError("No fields to update.")

    existing = await repo.get_with_details(invoice_id)
    changed_fields = list(values.keys())
    if items_payload is not None:
        changed_fields.append("items")
    old_values = _snapshot(existing, changed_fields)
    if items_payload is not None:
        old_values["items"] = [
            {
                "description": item.description,
                "quantity": str(item.quantity),
                "unitPrice": str(item.unit_price),
                "total": str(item.total),
            }
            for item in existing.items
        ]

    items = items_payload
    updated = await repo.update_draft(invoice_id, values, items=items)

    ip_address, user_agent = _client_meta(request)
    new_values = _snapshot(updated, changed_fields)
    if items_payload is not None:
        new_values["items"] = [
            {
                "description": item.description,
                "quantity": str(item.quantity),
                "unitPrice": str(item.unit_price),
                "total": str(item.total),
            }
            for item in updated.items
        ]
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="invoice.updated",
        entity="invoices",
        entity_id=updated.id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=_serialize_invoice(updated),
        message="Invoice updated.",
    )


@router.post(
    "/{invoice_id}/send",
    dependencies=[Depends(require_permission("invoices.send"))],
)
async def send_invoice(
    invoice_id: uuid.UUID,
    repo: InvoiceRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[InvoiceResponse]:
    existing = await repo.get_with_details(invoice_id)
    old_values = _snapshot(existing, ("status", "sent_at"))
    updated = await repo.send_invoice(invoice_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="invoice.sent",
        entity="invoices",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, ("status", "sent_at")),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=_serialize_invoice(updated),
        message="Invoice sent.",
    )


@router.post(
    "/{invoice_id}/void",
    dependencies=[Depends(require_permission("invoices.update"))],
)
async def void_invoice(
    invoice_id: uuid.UUID,
    repo: InvoiceRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[InvoiceResponse]:
    existing = await repo.get_with_details(invoice_id)
    old_values = _snapshot(existing, ("status", "voided_at"))
    updated = await repo.void_invoice(invoice_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="invoice.voided",
        entity="invoices",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, ("status", "voided_at")),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=_serialize_invoice(updated),
        message="Invoice voided.",
    )


@router.delete(
    "/{invoice_id}",
    dependencies=[Depends(require_permission("invoices.delete"))],
)
async def archive_invoice(
    invoice_id: uuid.UUID,
    repo: InvoiceRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get_with_details(invoice_id)
    snapshot = _snapshot(existing, ("invoice_number", "status", "customer_id"))
    await repo.archive_draft(invoice_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="invoice.archived",
        entity="invoices",
        entity_id=invoice_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Invoice archived.")
