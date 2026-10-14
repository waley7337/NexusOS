"""Tenant invoice Stripe Checkout HTTP API."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.finance import ActiveUser, DbSession
from app.payments.tenant.checkout_service import TenantInvoiceCheckoutService
from app.schemas.billing import InvoiceCheckoutResponse, money_str
from app.schemas.response import ApiResponse

router = APIRouter(tags=["Finance Payments"])


def _idempotency_key(value: str) -> str:
    key = value.strip()
    if not key:
        raise ValidationError("Idempotency-Key must not be blank.")
    if len(key) > 255:
        raise ValidationError("Idempotency-Key must be at most 255 characters.")
    return key


@router.post(
    "/invoices/{invoice_id}/checkout",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("payments.create"))],
)
async def create_invoice_checkout(
    invoice_id: uuid.UUID,
    db: DbSession,
    user: ActiveUser,
    idempotency_header: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
) -> ApiResponse[InvoiceCheckoutResponse]:
    key = _idempotency_key(idempotency_header)
    service = TenantInvoiceCheckoutService(
        db, company_id=user.company_id, user_id=user.id
    )
    session = await service.create_checkout(invoice_id=invoice_id, idempotency_key=key)
    return ApiResponse.ok(
        data=InvoiceCheckoutResponse.model_validate(
            {
                "paymentId": session.payment_id,
                "checkoutSessionId": session.checkout_session_id,
                "checkoutUrl": session.checkout_url,
                "amount": money_str(session.amount),
                "currency": session.currency,
                "reused": session.reused,
            }
        ),
        message="Checkout session created.",
    )
