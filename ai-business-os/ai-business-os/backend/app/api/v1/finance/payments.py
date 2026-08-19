"""Payments HTTP API — thin boundary over the 08.4.1 financial authority."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.finance import ActiveUser, DbSession, PaymentAuthority, PaymentRepo
from app.models.enums import PaymentStatus
from app.models.finance import Payment
from app.payments.currency import normalize_currency
from app.payments.idempotency import execute_idempotent, hash_canonical_request
from app.payments.money import quantize_money
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.finance import (
    ManualPaymentCreate,
    ManualPaymentRefund,
    PaymentResponse,
    payment_to_response,
)
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(tags=["Finance Payments"])

_RECORD_SCOPE = "payments.record"
_REFUND_SCOPE = "payments.refund"


def _idempotency_key(value: str) -> str:
    key = value.strip()
    if not key:
        raise ValidationError("Idempotency-Key must not be blank.")
    if len(key) > 255:
        raise ValidationError("Idempotency-Key must be at most 255 characters.")
    return key


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


def _currency(value: str) -> str:
    try:
        return normalize_currency(value)
    except ValueError as exc:
        raise ValidationError("Payment currency is invalid.") from exc


@router.post(
    "/invoices/{invoice_id}/payments",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("payments.create"))],
)
async def record_manual_payment(
    invoice_id: uuid.UUID,
    payload: ManualPaymentCreate,
    authority: PaymentAuthority,
    repo: PaymentRepo,
    db: DbSession,
    user: ActiveUser,
    request: Request,
    idempotency_header: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
) -> ApiResponse[PaymentResponse]:
    key = _idempotency_key(idempotency_header)
    currency = _currency(payload.currency)
    request_hash = hash_canonical_request(
        {
            "scope": _RECORD_SCOPE,
            "resourceId": str(invoice_id),
            "body": {
                "amount": format(payload.amount, ".2f"),
                "currency": currency,
                "paymentDate": payload.payment_date.isoformat(),
                "paymentMethod": payload.payment_method.value,
                "notes": payload.notes,
            },
        }
    )

    async def operation() -> Payment:
        payment = await authority.record_manual_payment(
            invoice_id=invoice_id,
            amount=payload.amount,
            currency=currency,
            payment_method=payload.payment_method,
            payment_date=payload.payment_date,
            notes=payload.notes,
            idempotency_key=key,
        )
        ip_address, user_agent = _client_meta(request)
        await audit_service.record(
            db,
            company_id=user.company_id,
            user_id=user.id,
            action="payment.recorded",
            entity="payments",
            entity_id=payment.id,
            new_values={
                "invoiceId": str(payment.invoice_id),
                "amount": format(payment.amount, ".2f"),
                "currency": payment.currency,
                "paymentDate": payment.payment_date.isoformat(),
                "paymentMethod": payment.payment_method.value,
                "source": payment.source.value,
                "status": payment.status.value,
                "confirmedAt": payment.confirmed_at.isoformat()
                if payment.confirmed_at
                else None,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return payment

    payment, _replay = await execute_idempotent(
        db,
        company_id=user.company_id,
        scope=_RECORD_SCOPE,
        idempotency_key=key,
        request_hash=request_hash,
        operation=operation,
        result_loader=repo.get_payment,
    )
    return ApiResponse.ok(data=payment_to_response(payment), message="Payment recorded.")


@router.get(
    "/invoices/{invoice_id}/payments",
    dependencies=[Depends(require_permission("payments.read"))],
)
async def list_invoice_payments(
    invoice_id: uuid.UUID,
    repo: PaymentRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
) -> ApiResponse[Paginated[PaymentResponse]]:
    rows, total = await repo.list_for_invoice(
        invoice_id, page=page, page_size=page_size
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[payment_to_response(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get(
    "/payments/{payment_id}",
    dependencies=[Depends(require_permission("payments.read"))],
)
async def get_payment(
    payment_id: uuid.UUID,
    repo: PaymentRepo,
) -> ApiResponse[PaymentResponse]:
    return ApiResponse.ok(data=payment_to_response(await repo.get_payment(payment_id)))


@router.post(
    "/payments/{payment_id}/refund",
    dependencies=[Depends(require_permission("payments.refund"))],
)
async def refund_manual_payment(
    payment_id: uuid.UUID,
    payload: ManualPaymentRefund,
    authority: PaymentAuthority,
    repo: PaymentRepo,
    db: DbSession,
    user: ActiveUser,
    request: Request,
    idempotency_header: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
) -> ApiResponse[PaymentResponse]:
    key = _idempotency_key(idempotency_header)
    request_hash = hash_canonical_request(
        {
            "scope": _REFUND_SCOPE,
            "resourceId": str(payment_id),
            "body": {
                "amount": format(payload.amount, ".2f"),
                "reason": payload.reason,
            },
        }
    )

    async def operation() -> Payment:
        payment = await authority.refund_manual_payment(
            payment_id=payment_id,
            amount=payload.amount,
            reason=payload.reason,
        )
        old_refunded = quantize_money(payment.refunded_amount - payload.amount)
        ip_address, user_agent = _client_meta(request)
        await audit_service.record(
            db,
            company_id=user.company_id,
            user_id=user.id,
            action="payment.refunded",
            entity="payments",
            entity_id=payment.id,
            old_values={
                "status": PaymentStatus.COMPLETED.value,
                "refundedAmount": format(old_refunded, ".2f"),
            },
            new_values={
                "invoiceId": str(payment.invoice_id),
                "refundAmount": format(payload.amount, ".2f"),
                "refundedAmount": format(payment.refunded_amount, ".2f"),
                "status": payment.status.value,
                "reason": payload.reason,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return payment

    payment, _replay = await execute_idempotent(
        db,
        company_id=user.company_id,
        scope=_REFUND_SCOPE,
        idempotency_key=key,
        request_hash=request_hash,
        operation=operation,
        result_loader=repo.get_payment,
    )
    return ApiResponse.ok(data=payment_to_response(payment), message="Payment refunded.")
