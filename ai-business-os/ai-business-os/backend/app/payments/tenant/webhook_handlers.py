"""Tenant-payment Stripe webhook handlers (Connect + Checkout)."""
from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import WebhookDomain, WebhookProcessingStatus
from app.models.payments import ProviderWebhookEvent
from app.payments.money import from_minor_units, quantize_money
from app.payments.providers.base import ProviderWebhookEvent as Envelope
from app.payments.webhook_ingest import claim_webhook_event, event_object, mark_webhook_processed
from app.repositories.payments import PaymentRepository
from app.services.payment_service import PaymentService

logger = structlog.get_logger("payments.tenant.webhooks")

_HANDLED = frozenset(
    {
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "charge.refunded",
        "account.updated",
    }
)


async def process_tenant_stripe_event(
    db: AsyncSession,
    *,
    envelope: Envelope,
    event: dict[str, Any],
) -> ProviderWebhookEvent:
    company_hint = _company_id_from_event(event)
    row, is_new = await claim_webhook_event(
        db,
        domain=WebhookDomain.TENANT_PAYMENTS,
        envelope=envelope,
        company_id=company_hint,
    )
    if not is_new and row.processing_status in {
        WebhookProcessingStatus.PROCESSED,
        WebhookProcessingStatus.IGNORED,
    }:
        return row

    if envelope.event_type not in _HANDLED:
        await mark_webhook_processed(db, row, status=WebhookProcessingStatus.IGNORED)
        return row

    try:
        company_id = await _dispatch(
            db,
            envelope.event_type,
            event,
            connected_account_id=envelope.provider_account_ref,
        )
        await mark_webhook_processed(
            db,
            row,
            status=WebhookProcessingStatus.PROCESSED,
            company_id=company_id or company_hint,
        )
    except Exception as exc:
        logger.exception(
            "tenant_webhook_failed",
            event_id=envelope.external_event_id,
            event_type=envelope.event_type,
        )
        await mark_webhook_processed(
            db,
            row,
            status=WebhookProcessingStatus.FAILED,
            failure_reason=str(exc),
            company_id=company_hint,
        )
        raise
    return row


async def _dispatch(
    db: AsyncSession,
    event_type: str,
    event: dict[str, Any],
    *,
    connected_account_id: str | None,
) -> uuid.UUID | None:
    obj = event_object(event)
    if event_type == "account.updated":
        return await _handle_account_updated(db, obj)

    metadata = obj.get("metadata") or {}
    # Platform SaaS Checkout/Billing objects must never confirm tenant invoices.
    if metadata.get("domain") == "platform_billing":
        return None
    if metadata.get("domain") not in {None, "tenant_payments"}:
        return None

    company_raw = metadata.get("company_id")
    payment_raw = metadata.get("payment_id") or obj.get("client_reference_id")
    if not company_raw:
        raise ConflictError("Webhook missing company metadata.", details={"reason": "webhook_company_missing"})
    company_id = uuid.UUID(str(company_raw))

    if event_type in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    }:
        await _confirm_from_checkout(
            db,
            company_id=company_id,
            session_obj=obj,
            payment_raw=payment_raw,
            connected_account_id=connected_account_id,
        )
    elif event_type in {"checkout.session.expired", "checkout.session.async_payment_failed"}:
        await _fail_from_checkout(
            db,
            company_id=company_id,
            session_obj=obj,
            payment_raw=payment_raw,
            connected_account_id=connected_account_id,
        )
    elif event_type == "payment_intent.succeeded":
        await _confirm_from_payment_intent(
            db,
            company_id=company_id,
            pi=obj,
            payment_raw=payment_raw,
            connected_account_id=connected_account_id,
        )
    elif event_type == "payment_intent.payment_failed":
        await _fail_from_payment_intent(
            db,
            company_id=company_id,
            pi=obj,
            payment_raw=payment_raw,
            connected_account_id=connected_account_id,
        )
    elif event_type == "charge.refunded":
        await _refund_from_charge(
            db,
            company_id=company_id,
            charge=obj,
            connected_account_id=connected_account_id,
        )
    return company_id


async def _handle_account_updated(db: AsyncSession, account_obj: dict[str, Any]) -> uuid.UUID | None:
    from sqlalchemy import select

    from app.models.enums import PaymentProviderKind
    from app.models.payments import PaymentProviderAccount
    from app.repositories.payment_providers import PaymentProviderAccountRepository

    external_id = str(account_obj.get("id") or "")
    if not external_id:
        return None
    account = (
        await db.execute(
            select(PaymentProviderAccount).where(
                PaymentProviderAccount.provider == PaymentProviderKind.STRIPE,
                PaymentProviderAccount.external_account_id == external_id,
            )
        )
    ).scalar_one_or_none()
    if account is None:
        return None
    repo = PaymentProviderAccountRepository(db, company_id=account.company_id)
    await repo.apply_stripe_account_snapshot(
        account,
        charges_enabled=bool(account_obj.get("charges_enabled")),
        payouts_enabled=bool(account_obj.get("payouts_enabled")),
        details_submitted=bool(account_obj.get("details_submitted")),
    )
    return account.company_id


async def _resolve_payment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    payment_raw: object | None,
    checkout_session_id: str | None = None,
    provider_payment_id: str | None = None,
):
    repo = PaymentRepository(db, company_id=company_id, user_id=None)
    if payment_raw:
        try:
            return await repo.get_payment(uuid.UUID(str(payment_raw)))
        except (NotFoundError, ValueError):
            pass
    if checkout_session_id:
        found = await repo.find_by_checkout_session(checkout_session_id)
        if found:
            return found
    if provider_payment_id:
        found = await repo.find_by_provider_payment_id(provider_payment_id)
        if found:
            return found
    raise NotFoundError("Payment not found for webhook")


async def _assert_connect_account_matches(
    db: AsyncSession,
    *,
    payment,
    connected_account_id: str | None,
) -> None:
    """Bind Connect webhook `account` to the payment's provider account.

    Without this check, a connected account that forges Checkout/PI metadata
    could confirm another tenant's pending payment row.
    """
    from sqlalchemy import select

    from app.models.payments import PaymentProviderAccount

    if not connected_account_id:
        raise ConflictError(
            "Connect webhook missing connected account id.",
            details={"reason": "webhook_connect_account_missing"},
        )
    if payment.provider_account_id is None:
        raise ConflictError(
            "Provider payment is missing its Connect account link.",
            details={"reason": "payment_provider_account_missing"},
        )
    account = (
        await db.execute(
            select(PaymentProviderAccount).where(
                PaymentProviderAccount.id == payment.provider_account_id,
                PaymentProviderAccount.company_id == payment.company_id,
            )
        )
    ).scalar_one_or_none()
    if account is None or account.external_account_id != connected_account_id:
        raise ConflictError(
            "Webhook connected account does not match the payment provider account.",
            details={"reason": "webhook_connect_account_mismatch"},
        )


async def _confirm_from_checkout(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    session_obj: dict[str, Any],
    payment_raw: object | None,
    connected_account_id: str | None,
) -> None:
    if session_obj.get("payment_status") not in {None, "paid", "no_payment_required"}:
        # unpaid / unpaid sessions are not confirmation
        if session_obj.get("payment_status") != "paid":
            return
    payment = await _resolve_payment(
        db,
        company_id=company_id,
        payment_raw=payment_raw,
        checkout_session_id=str(session_obj.get("id") or "") or None,
        provider_payment_id=str(session_obj.get("payment_intent") or "") or None,
    )
    await _assert_connect_account_matches(
        db, payment=payment, connected_account_id=connected_account_id
    )
    amount_total = session_obj.get("amount_total")
    currency = str(session_obj.get("currency") or payment.currency).upper()
    if amount_total is None:
        amount = payment.amount
    else:
        amount = from_minor_units(int(amount_total), currency)
    authority = PaymentService(PaymentRepository(db, company_id=company_id, user_id=None))
    await authority.confirm_provider_payment(
        payment_id=payment.id,
        amount=amount,
        currency=currency,
        provider_payment_id=str(session_obj.get("payment_intent") or "") or payment.provider_payment_id,
        checkout_session_id=str(session_obj.get("id") or "") or None,
    )


async def _fail_from_checkout(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    session_obj: dict[str, Any],
    payment_raw: object | None,
    connected_account_id: str | None,
) -> None:
    payment = await _resolve_payment(
        db,
        company_id=company_id,
        payment_raw=payment_raw,
        checkout_session_id=str(session_obj.get("id") or "") or None,
    )
    await _assert_connect_account_matches(
        db, payment=payment, connected_account_id=connected_account_id
    )
    authority = PaymentService(PaymentRepository(db, company_id=company_id, user_id=None))
    await authority.fail_provider_payment(
        payment_id=payment.id,
        failure_code="checkout_failed",
        failure_message=f"Checkout session {session_obj.get('status') or 'failed'}",
    )


async def _confirm_from_payment_intent(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    pi: dict[str, Any],
    payment_raw: object | None,
    connected_account_id: str | None,
) -> None:
    payment = await _resolve_payment(
        db,
        company_id=company_id,
        payment_raw=payment_raw,
        provider_payment_id=str(pi.get("id") or "") or None,
    )
    await _assert_connect_account_matches(
        db, payment=payment, connected_account_id=connected_account_id
    )
    currency = str(pi.get("currency") or payment.currency).upper()
    amount = from_minor_units(int(pi.get("amount_received") or pi.get("amount") or 0), currency)
    if amount <= 0:
        amount = quantize_money(payment.amount)
    authority = PaymentService(PaymentRepository(db, company_id=company_id, user_id=None))
    await authority.confirm_provider_payment(
        payment_id=payment.id,
        amount=amount,
        currency=currency,
        provider_payment_id=str(pi.get("id") or ""),
    )


async def _fail_from_payment_intent(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    pi: dict[str, Any],
    payment_raw: object | None,
    connected_account_id: str | None,
) -> None:
    payment = await _resolve_payment(
        db,
        company_id=company_id,
        payment_raw=payment_raw,
        provider_payment_id=str(pi.get("id") or "") or None,
    )
    await _assert_connect_account_matches(
        db, payment=payment, connected_account_id=connected_account_id
    )
    err = pi.get("last_payment_error") or {}
    authority = PaymentService(PaymentRepository(db, company_id=company_id, user_id=None))
    await authority.fail_provider_payment(
        payment_id=payment.id,
        failure_code=str(err.get("code") or "payment_intent_failed")[:100],
        failure_message=str(err.get("message") or "Payment intent failed")[:500],
    )


async def _refund_from_charge(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    charge: dict[str, Any],
    connected_account_id: str | None,
) -> None:
    pi = str(charge.get("payment_intent") or "")
    if not pi:
        return
    repo = PaymentRepository(db, company_id=company_id, user_id=None)
    payment = await repo.find_by_provider_payment_id(pi)
    if payment is None:
        raise NotFoundError("Payment not found for refund webhook")
    await _assert_connect_account_matches(
        db, payment=payment, connected_account_id=connected_account_id
    )
    currency = str(charge.get("currency") or payment.currency).upper()
    refunded = from_minor_units(int(charge.get("amount_refunded") or 0), currency)
    already = quantize_money(payment.refunded_amount)
    delta = quantize_money(refunded - already)
    if delta <= 0:
        return
    refunds = (charge.get("refunds") or {}).get("data") or []
    refund_id = str(refunds[0].get("id")) if refunds else None
    authority = PaymentService(repo)
    await authority.apply_provider_refund(
        payment_id=payment.id,
        refund_amount=delta,
        provider_refund_id=refund_id,
        reason="stripe_charge_refunded",
    )


def _company_id_from_event(event: dict[str, Any]) -> uuid.UUID | None:
    obj = event_object(event)
    metadata = obj.get("metadata") or {}
    raw = metadata.get("company_id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None
