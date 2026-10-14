"""NexusOS SaaS subscription billing — platform Stripe account only."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.models.enums import PlatformPlan, PlatformSubscriptionStatus
from app.models.payments import PlatformBillingProfile
from app.payments.providers.stripe.client import stripe_module
from app.payments.stripe_config import (
    plan_for_price_id,
    price_id_for_plan,
    require_billing_enabled,
)
from app.repositories.platform_billing import PlatformBillingProfileRepository

logger = structlog.get_logger("payments.platform.billing")

_ENTITLED = frozenset(
    {
        PlatformSubscriptionStatus.ACTIVE,
        PlatformSubscriptionStatus.TRIALING,
    }
)


@dataclass(frozen=True, slots=True)
class BillingCheckoutSession:
    checkout_url: str
    checkout_session_id: str
    plan: PlatformPlan


@dataclass(frozen=True, slots=True)
class BillingPortalSession:
    portal_url: str


class PlatformBillingService:
    """Server-authoritative SaaS subscription lifecycle (separate from tenant payments)."""

    def __init__(self, db: AsyncSession, *, company_id: uuid.UUID) -> None:
        self.db = db
        self.company_id = company_id
        self.repo = PlatformBillingProfileRepository(db, company_id=company_id)

    async def get_profile(self) -> PlatformBillingProfile:
        return await self.repo.get_authoritative()

    def is_entitled(self, profile: PlatformBillingProfile) -> bool:
        if profile.plan == PlatformPlan.FREE:
            return True
        return profile.status in _ENTITLED

    def require_entitlement(
        self,
        profile: PlatformBillingProfile,
        *,
        minimum_plan: PlatformPlan | None = None,
    ) -> None:
        """Server-side entitlement gate — never trust client plan/status."""
        if not self.is_entitled(profile):
            raise ConflictError(
                "Company subscription is not active.",
                details={"reason": "subscription_not_entitled", "status": profile.status.value},
            )
        if minimum_plan is None:
            return
        order = [
            PlatformPlan.FREE,
            PlatformPlan.STARTER,
            PlatformPlan.PRO,
            PlatformPlan.ENTERPRISE,
        ]
        if order.index(profile.plan) < order.index(minimum_plan):
            raise ConflictError(
                "Company plan does not include this feature.",
                details={
                    "reason": "plan_insufficient",
                    "plan": profile.plan.value,
                    "required": minimum_plan.value,
                },
            )

    async def create_checkout(
        self,
        *,
        plan: PlatformPlan,
        idempotency_key: str,
        success_path: str = "/settings?billing=success",
        cancel_path: str = "/settings?billing=cancel",
    ) -> BillingCheckoutSession:
        api_key = require_billing_enabled()
        if not success_path.startswith("/") or not cancel_path.startswith("/"):
            raise ValidationError("Billing return paths must be relative.")
        price_id = price_id_for_plan(plan)
        profile = await self.repo.get_authoritative()
        if (
            profile.status in _ENTITLED
            and profile.plan == plan
            and profile.stripe_subscription_id
        ):
            raise ConflictError(
                "Company already has an active subscription for this plan.",
                details={"reason": "subscription_already_active"},
            )

        stripe = stripe_module(api_key=api_key)
        customer_id = profile.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                metadata={"company_id": str(self.company_id), "domain": "platform_billing"},
                idempotency_key=f"platform-customer:{self.company_id}",
            )
            customer_id = customer["id"] if isinstance(customer, dict) else customer.id
            profile.stripe_customer_id = customer_id
            await self.db.flush()
            await self.db.commit()

        frontend = settings.FRONTEND_URL.rstrip("/")
        try:
            session = stripe.checkout.Session.create(
                mode="subscription",
                customer=customer_id,
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=f"{frontend}{success_path}&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{frontend}{cancel_path}",
                client_reference_id=str(self.company_id),
                metadata={
                    "domain": "platform_billing",
                    "company_id": str(self.company_id),
                    "plan": plan.value,
                },
                subscription_data={
                    "metadata": {
                        "domain": "platform_billing",
                        "company_id": str(self.company_id),
                        "plan": plan.value,
                    },
                },
                idempotency_key=idempotency_key,
            )
        except Exception as exc:
            logger.warning(
                "platform_checkout_create_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to start subscription checkout.",
                details={"reason": "stripe_billing_checkout_failed"},
            ) from None

        return BillingCheckoutSession(
            checkout_url=str(session["url"] if isinstance(session, dict) else session.url),
            checkout_session_id=str(session["id"] if isinstance(session, dict) else session.id),
            plan=plan,
        )

    async def create_portal(self, *, return_path: str = "/settings?billing=portal") -> BillingPortalSession:
        api_key = require_billing_enabled()
        if not return_path.startswith("/"):
            raise ValidationError("Portal return path must be relative.")
        profile = await self.repo.get_authoritative()
        if not profile.stripe_customer_id:
            raise ConflictError(
                "No Stripe customer is linked to this company.",
                details={"reason": "stripe_customer_missing"},
            )
        stripe = stripe_module(api_key=api_key)
        frontend = settings.FRONTEND_URL.rstrip("/")
        try:
            session = stripe.billing_portal.Session.create(
                customer=profile.stripe_customer_id,
                return_url=f"{frontend}{return_path}",
            )
        except Exception as exc:
            logger.warning(
                "platform_portal_create_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to open the billing portal.",
                details={"reason": "stripe_billing_portal_failed"},
            ) from None
        return BillingPortalSession(
            portal_url=str(session["url"] if isinstance(session, dict) else session.url)
        )

    async def cancel_at_period_end(self) -> PlatformBillingProfile:
        api_key = require_billing_enabled()
        profile = await self.repo.get_authoritative()
        if not profile.stripe_subscription_id:
            raise ConflictError(
                "No active subscription to cancel.",
                details={"reason": "subscription_missing"},
            )
        stripe = stripe_module(api_key=api_key)
        try:
            remote = stripe.Subscription.modify(
                profile.stripe_subscription_id,
                cancel_at_period_end=True,
            )
        except Exception as exc:
            logger.warning(
                "platform_cancel_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to cancel the subscription.",
                details={"reason": "stripe_subscription_cancel_failed"},
            ) from None
        return await self.apply_subscription_snapshot(remote, event_id=None)

    async def apply_subscription_snapshot(
        self,
        subscription: object,
        *,
        event_id: str | None,
        fallback_plan: PlatformPlan | None = None,
    ) -> PlatformBillingProfile:
        profile = await self.repo.get_authoritative()
        data = subscription if isinstance(subscription, dict) else subscription.to_dict()
        incoming_id = str(data.get("id") or "") or None
        # Ignore delayed events for a previous subscription after a newer one is linked.
        if (
            profile.stripe_subscription_id
            and incoming_id
            and incoming_id != profile.stripe_subscription_id
        ):
            logger.info(
                "platform_subscription_snapshot_ignored_other_id",
                company_id=str(self.company_id),
                linked_subscription_id=profile.stripe_subscription_id,
                event_subscription_id=incoming_id,
            )
            return profile

        status = _map_subscription_status(str(data.get("status") or ""))
        # Delayed "active"/"past_due" updates must not resurrect a canceled subscription.
        if (
            profile.status == PlatformSubscriptionStatus.CANCELED
            and status != PlatformSubscriptionStatus.CANCELED
        ):
            logger.info(
                "platform_subscription_snapshot_ignored_after_cancel",
                company_id=str(self.company_id),
                event_status=status.value,
            )
            return profile

        price_id = None
        items = (data.get("items") or {}).get("data") or []
        if items:
            price = items[0].get("price") or {}
            price_id = price.get("id")
        plan = plan_for_price_id(price_id) if price_id else None
        if plan is None:
            plan = fallback_plan or profile.plan

        profile.stripe_subscription_id = incoming_id or profile.stripe_subscription_id
        if data.get("customer"):
            profile.stripe_customer_id = str(data["customer"])
        profile.stripe_price_id = price_id or profile.stripe_price_id
        if status == PlatformSubscriptionStatus.CANCELED:
            profile.plan = PlatformPlan.FREE
        else:
            profile.plan = plan
        profile.status = status
        profile.cancel_at_period_end = bool(data.get("cancel_at_period_end"))
        profile.current_period_start = _ts(data.get("current_period_start"))
        profile.current_period_end = _ts(data.get("current_period_end"))
        profile.canceled_at = _ts(data.get("canceled_at"))
        profile.trial_ends_at = _ts(data.get("trial_end"))
        profile.last_synced_at = datetime.now(UTC)
        if event_id:
            profile.last_webhook_event_id = event_id
        await self.db.flush()
        return profile


def _ts(value: object) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def _map_subscription_status(raw: str) -> PlatformSubscriptionStatus:
    mapping = {
        "trialing": PlatformSubscriptionStatus.TRIALING,
        "active": PlatformSubscriptionStatus.ACTIVE,
        "past_due": PlatformSubscriptionStatus.PAST_DUE,
        "incomplete": PlatformSubscriptionStatus.INCOMPLETE,
        "incomplete_expired": PlatformSubscriptionStatus.CANCELED,
        "canceled": PlatformSubscriptionStatus.CANCELED,
        "unpaid": PlatformSubscriptionStatus.PAST_DUE,
        "paused": PlatformSubscriptionStatus.PAUSED,
    }
    return mapping.get(raw, PlatformSubscriptionStatus.INCOMPLETE)
