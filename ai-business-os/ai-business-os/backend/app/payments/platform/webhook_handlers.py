"""Platform SaaS billing Stripe webhook handlers."""
from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import PlatformPlan, PlatformSubscriptionStatus, WebhookDomain, WebhookProcessingStatus
from app.models.payments import PlatformBillingProfile, ProviderWebhookEvent
from app.payments.platform.billing_service import PlatformBillingService
from app.payments.providers.base import ProviderWebhookEvent as Envelope
from app.payments.webhook_ingest import claim_webhook_event, event_object, mark_webhook_processed

logger = structlog.get_logger("payments.platform.webhooks")

_HANDLED = frozenset(
    {
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
    }
)


async def process_platform_stripe_event(
    db: AsyncSession,
    *,
    envelope: Envelope,
    event: dict[str, Any],
) -> ProviderWebhookEvent:
    company_hint = _company_id_from_event(event)
    row, is_new = await claim_webhook_event(
        db,
        domain=WebhookDomain.PLATFORM_BILLING,
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
        company_id = await _dispatch(db, envelope.event_type, event, event_id=envelope.external_event_id)
        await mark_webhook_processed(
            db,
            row,
            status=WebhookProcessingStatus.PROCESSED,
            company_id=company_id or company_hint,
        )
    except Exception as exc:
        logger.exception(
            "platform_webhook_failed",
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
    event_id: str,
) -> uuid.UUID | None:
    obj = event_object(event)
    if event_type == "checkout.session.completed":
        if obj.get("mode") != "subscription":
            return None
        # Tenant invoice Checkout must never grant SaaS entitlements.
        meta = obj.get("metadata") or {}
        if meta.get("domain") == "tenant_payments":
            return None
        company_id = _require_company_id(obj)
        service = PlatformBillingService(db, company_id=company_id)
        subscription_id = obj.get("subscription")
        if not subscription_id:
            raise ConflictError("Checkout session missing subscription id.")
        # Persist linkage immediately; status is refined by subscription events.
        profile = await service.get_profile()
        profile.stripe_customer_id = str(obj.get("customer") or profile.stripe_customer_id or "")
        profile.stripe_subscription_id = str(subscription_id)
        meta_plan = (obj.get("metadata") or {}).get("plan")
        if meta_plan:
            try:
                profile.plan = PlatformPlan(str(meta_plan))
            except ValueError:
                pass
        profile.status = PlatformSubscriptionStatus.INCOMPLETE
        profile.last_webhook_event_id = event_id
        await db.flush()
        return company_id

    if event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        company_id = await _company_from_subscription(db, obj)
        service = PlatformBillingService(db, company_id=company_id)
        await service.apply_subscription_snapshot(obj, event_id=event_id)
        return company_id

    if event_type == "invoice.paid":
        company_id = await _company_from_invoice(db, obj)
        service = PlatformBillingService(db, company_id=company_id)
        profile = await service.get_profile()
        if profile.status in {
            PlatformSubscriptionStatus.PAST_DUE,
            PlatformSubscriptionStatus.INCOMPLETE,
            PlatformSubscriptionStatus.NO_SUBSCRIPTION,
        }:
            profile.status = PlatformSubscriptionStatus.ACTIVE
            profile.last_webhook_event_id = event_id
            await db.flush()
        return company_id

    if event_type == "invoice.payment_failed":
        company_id = await _company_from_invoice(db, obj)
        service = PlatformBillingService(db, company_id=company_id)
        profile = await service.get_profile()
        # Delayed failure events must not mutate a fully canceled subscription.
        if profile.status == PlatformSubscriptionStatus.CANCELED:
            return company_id
        if profile.status in {
            PlatformSubscriptionStatus.ACTIVE,
            PlatformSubscriptionStatus.TRIALING,
            PlatformSubscriptionStatus.INCOMPLETE,
            PlatformSubscriptionStatus.PAST_DUE,
            PlatformSubscriptionStatus.PAUSED,
            PlatformSubscriptionStatus.NO_SUBSCRIPTION,
        }:
            profile.status = PlatformSubscriptionStatus.PAST_DUE
            profile.last_webhook_event_id = event_id
            await db.flush()
        return company_id

    return None


async def _company_from_subscription(db: AsyncSession, obj: dict[str, Any]) -> uuid.UUID:
    meta = obj.get("metadata") or {}
    if meta.get("company_id"):
        return uuid.UUID(str(meta["company_id"]))
    sub_id = str(obj.get("id") or "")
    if sub_id:
        profile = (
            await db.execute(
                select(PlatformBillingProfile).where(
                    PlatformBillingProfile.stripe_subscription_id == sub_id
                )
            )
        ).scalar_one_or_none()
        if profile:
            return profile.company_id
    customer_id = str(obj.get("customer") or "")
    if customer_id:
        profile = (
            await db.execute(
                select(PlatformBillingProfile).where(
                    PlatformBillingProfile.stripe_customer_id == customer_id
                )
            )
        ).scalar_one_or_none()
        if profile:
            return profile.company_id
    raise NotFoundError("Billing profile not found for subscription webhook")


async def _company_from_invoice(db: AsyncSession, obj: dict[str, Any]) -> uuid.UUID:
    sub_id = str(obj.get("subscription") or "")
    if sub_id:
        profile = (
            await db.execute(
                select(PlatformBillingProfile).where(
                    PlatformBillingProfile.stripe_subscription_id == sub_id
                )
            )
        ).scalar_one_or_none()
        if profile:
            return profile.company_id
    customer_id = str(obj.get("customer") or "")
    if customer_id:
        profile = (
            await db.execute(
                select(PlatformBillingProfile).where(
                    PlatformBillingProfile.stripe_customer_id == customer_id
                )
            )
        ).scalar_one_or_none()
        if profile:
            return profile.company_id
    raise NotFoundError("Billing profile not found for invoice webhook")


def _require_company_id(obj: dict[str, Any]) -> uuid.UUID:
    meta = obj.get("metadata") or {}
    raw = meta.get("company_id") or obj.get("client_reference_id")
    if not raw:
        raise ConflictError("Webhook missing company metadata.")
    return uuid.UUID(str(raw))


def _company_id_from_event(event: dict[str, Any]) -> uuid.UUID | None:
    obj = event_object(event)
    meta = obj.get("metadata") or {}
    raw = meta.get("company_id") or obj.get("client_reference_id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None
