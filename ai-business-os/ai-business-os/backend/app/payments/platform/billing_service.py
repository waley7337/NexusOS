"""NexusOS SaaS subscription billing — platform Stripe account only."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.models.enums import PlatformPlan, PlatformSubscriptionStatus
from app.models.payments import PlatformBillingProfile
from app.payments.providers.stripe.client import stripe_module
from app.payments.stripe_config import (
    billing_live,
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

# Linked Stripe subscription exists — never open a second Checkout Session.
_BLOCK_NEW_CHECKOUT = frozenset(
    {
        PlatformSubscriptionStatus.ACTIVE,
        PlatformSubscriptionStatus.TRIALING,
        PlatformSubscriptionStatus.PAST_DUE,
        PlatformSubscriptionStatus.INCOMPLETE,
        PlatformSubscriptionStatus.PAUSED,
    }
)

# In-place plan changes only when payment is current. past_due → billing portal
# recovery first (Stripe: unpaid updates can apply then leave the sub past_due).
_ALLOW_IN_PLACE_PLAN_CHANGE = frozenset(
    {
        PlatformSubscriptionStatus.ACTIVE,
        PlatformSubscriptionStatus.TRIALING,
    }
)

CheckoutMode = Literal["checkout", "subscription_updated"]
CheckoutUiMode = Literal["hosted", "elements"]


@dataclass(frozen=True, slots=True)
class BillingCheckoutSession:
    checkout_url: str | None
    checkout_session_id: str | None
    plan: PlatformPlan
    mode: CheckoutMode = "checkout"
    client_secret: str | None = None
    publishable_key: str | None = None
    ui_mode: CheckoutUiMode = "hosted"


@dataclass(frozen=True, slots=True)
class BillingPortalSession:
    portal_url: str


@dataclass(frozen=True, slots=True)
class BillingPlanPriceSnapshot:
    plan: PlatformPlan
    price_id: str | None
    currency: str | None
    unit_amount: int | None
    interval: str | None
    interval_count: int | None
    product_name: str | None
    configured: bool


@dataclass(frozen=True, slots=True)
class BillingPlansCatalog:
    billing_enabled: bool
    publishable_key: str | None
    plans: list[BillingPlanPriceSnapshot]


@dataclass(frozen=True, slots=True)
class BillingCheckoutSessionStatus:
    status: str
    payment_status: str
    plan: PlatformPlan | None
    checkout_session_id: str


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
        ui_mode: CheckoutUiMode = "hosted",
        success_path: str = "/settings?billing=success",
        cancel_path: str = "/settings?billing=cancel",
        return_path: str = "/billing/checkout/return?billing=success",
    ) -> BillingCheckoutSession:
        api_key = require_billing_enabled()
        if ui_mode not in ("hosted", "elements"):
            raise ValidationError(
                "Unsupported checkout UI mode.",
                details={"reason": "checkout_ui_mode_invalid"},
            )
        if not success_path.startswith("/") or not cancel_path.startswith("/"):
            raise ValidationError("Billing return paths must be relative.")
        if not return_path.startswith("/"):
            raise ValidationError("Billing return path must be relative.")
        price_id = price_id_for_plan(plan)
        # Serialize concurrent checkout/upgrade attempts for this company.
        profile = await self.repo.get_authoritative_for_update()

        if profile.stripe_subscription_id and profile.status in _BLOCK_NEW_CHECKOUT:
            if profile.plan == plan and profile.status in _ENTITLED:
                raise ConflictError(
                    "Company already has an active subscription for this plan.",
                    details={"reason": "subscription_already_active"},
                )
            if profile.status == PlatformSubscriptionStatus.INCOMPLETE:
                raise ConflictError(
                    "An incomplete subscription already exists. Complete payment via the "
                    "billing portal — a second checkout would create a duplicate subscription.",
                    details={"reason": "subscription_incomplete"},
                )
            if profile.status == PlatformSubscriptionStatus.PAUSED:
                raise ConflictError(
                    "Subscription is paused. Resume or change plans via the billing portal.",
                    details={"reason": "subscription_paused"},
                )
            if profile.status == PlatformSubscriptionStatus.PAST_DUE:
                raise ConflictError(
                    "Subscription payment failed. Update payment method via the billing portal "
                    "before changing plans.",
                    details={"reason": "subscription_past_due"},
                )
            if profile.status in _ALLOW_IN_PLACE_PLAN_CHANGE and profile.plan != plan:
                return await self._upgrade_existing_subscription(
                    profile,
                    plan=plan,
                    price_id=price_id,
                    idempotency_key=idempotency_key,
                    api_key=api_key,
                )
            raise ConflictError(
                "Company already has a Stripe subscription. Use plan change or the billing portal.",
                details={"reason": "subscription_already_linked"},
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
            # Re-lock after commit so concurrent callers still serialize.
            profile = await self.repo.get_authoritative_for_update()
            if profile.stripe_subscription_id and profile.status in _BLOCK_NEW_CHECKOUT:
                raise ConflictError(
                    "Company already has a Stripe subscription. Use plan change or the billing portal.",
                    details={"reason": "subscription_already_linked"},
                )
            customer_id = profile.stripe_customer_id or customer_id

        frontend = settings.FRONTEND_URL.rstrip("/")
        create_kwargs: dict = {
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "client_reference_id": str(self.company_id),
            "metadata": {
                "domain": "platform_billing",
                "company_id": str(self.company_id),
                "plan": plan.value,
            },
            "subscription_data": {
                "metadata": {
                    "domain": "platform_billing",
                    "company_id": str(self.company_id),
                    "plan": plan.value,
                },
            },
            "idempotency_key": idempotency_key,
        }
        if ui_mode == "elements":
            # Custom NexusOS Payment Element UI — no hosted Checkout URL.
            create_kwargs["ui_mode"] = "elements"
            create_kwargs["return_url"] = (
                f"{frontend}{return_path}&session_id={{CHECKOUT_SESSION_ID}}"
            )
            create_kwargs["billing_address_collection"] = "auto"
        else:
            create_kwargs["success_url"] = (
                f"{frontend}{success_path}&session_id={{CHECKOUT_SESSION_ID}}"
            )
            create_kwargs["cancel_url"] = f"{frontend}{cancel_path}"

        try:
            session = stripe.checkout.Session.create(**create_kwargs)
        except Exception as exc:
            logger.warning(
                "platform_checkout_create_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
                ui_mode=ui_mode,
            )
            raise ConflictError(
                "Unable to start subscription checkout.",
                details={"reason": "stripe_billing_checkout_failed"},
            ) from None

        session_id = str(session["id"] if isinstance(session, dict) else session.id)
        publishable = (settings.STRIPE_PLATFORM_PUBLISHABLE_KEY or "").strip() or None
        if ui_mode == "elements":
            secret = session["client_secret"] if isinstance(session, dict) else session.client_secret
            if not secret:
                raise ConflictError(
                    "Unable to start subscription checkout.",
                    details={"reason": "stripe_billing_checkout_failed"},
                )
            return BillingCheckoutSession(
                checkout_url=None,
                checkout_session_id=session_id,
                plan=plan,
                mode="checkout",
                client_secret=str(secret),
                publishable_key=publishable,
                ui_mode="elements",
            )

        return BillingCheckoutSession(
            checkout_url=str(session["url"] if isinstance(session, dict) else session.url),
            checkout_session_id=session_id,
            plan=plan,
            mode="checkout",
            ui_mode="hosted",
        )

    async def list_plan_catalog(self) -> BillingPlansCatalog:
        """Trusted plan pricing from Stripe Price IDs — fail closed when billing is off."""
        publishable = (settings.STRIPE_PLATFORM_PUBLISHABLE_KEY or "").strip() or None
        if not billing_live():
            return BillingPlansCatalog(
                billing_enabled=False,
                publishable_key=None,
                plans=[
                    BillingPlanPriceSnapshot(
                        plan=plan,
                        price_id=None,
                        currency=None,
                        unit_amount=None,
                        interval=None,
                        interval_count=None,
                        product_name=None,
                        configured=False,
                    )
                    for plan in (
                        PlatformPlan.STARTER,
                        PlatformPlan.PRO,
                        PlatformPlan.ENTERPRISE,
                    )
                ],
            )

        api_key = require_billing_enabled()
        stripe = stripe_module(api_key=api_key)
        snapshots: list[BillingPlanPriceSnapshot] = []
        for plan in (PlatformPlan.STARTER, PlatformPlan.PRO, PlatformPlan.ENTERPRISE):
            try:
                price_id = price_id_for_plan(plan)
            except Exception:
                snapshots.append(
                    BillingPlanPriceSnapshot(
                        plan=plan,
                        price_id=None,
                        currency=None,
                        unit_amount=None,
                        interval=None,
                        interval_count=None,
                        product_name=None,
                        configured=False,
                    )
                )
                continue
            try:
                remote = stripe.Price.retrieve(price_id, expand=["product"])
                data = remote if isinstance(remote, dict) else remote.to_dict()
                recurring = data.get("recurring") or {}
                product = data.get("product")
                product_name = None
                if isinstance(product, dict):
                    product_name = product.get("name")
                elif isinstance(product, str):
                    product_name = None
                snapshots.append(
                    BillingPlanPriceSnapshot(
                        plan=plan,
                        price_id=price_id,
                        currency=str(data.get("currency") or "").lower() or None,
                        unit_amount=int(data["unit_amount"])
                        if data.get("unit_amount") is not None
                        else None,
                        interval=str(recurring.get("interval")) if recurring.get("interval") else None,
                        interval_count=int(recurring["interval_count"])
                        if recurring.get("interval_count") is not None
                        else None,
                        product_name=str(product_name) if product_name else None,
                        configured=True,
                    )
                )
            except Exception as exc:
                logger.warning(
                    "platform_price_retrieve_failed",
                    company_id=str(self.company_id),
                    plan=plan.value,
                    error_type=type(exc).__name__,
                )
                snapshots.append(
                    BillingPlanPriceSnapshot(
                        plan=plan,
                        price_id=price_id,
                        currency=None,
                        unit_amount=None,
                        interval=None,
                        interval_count=None,
                        product_name=None,
                        configured=False,
                    )
                )
        return BillingPlansCatalog(
            billing_enabled=True,
            publishable_key=publishable,
            plans=snapshots,
        )

    async def get_checkout_session_status(
        self, *, checkout_session_id: str
    ) -> BillingCheckoutSessionStatus:
        """Return Checkout Session status for UI only — entitlements stay webhook-driven."""
        api_key = require_billing_enabled()
        session_id = checkout_session_id.strip()
        if not session_id.startswith("cs_"):
            raise ValidationError(
                "Invalid checkout session id.",
                details={"reason": "checkout_session_invalid"},
            )
        stripe = stripe_module(api_key=api_key)
        try:
            remote = stripe.checkout.Session.retrieve(session_id)
            data = remote if isinstance(remote, dict) else remote.to_dict()
        except Exception as exc:
            logger.warning(
                "platform_checkout_status_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to load checkout session status.",
                details={"reason": "stripe_checkout_status_failed"},
            ) from None

        metadata = data.get("metadata") or {}
        if str(metadata.get("domain") or "") != "platform_billing":
            raise ConflictError(
                "Checkout session is not a NexusOS billing session.",
                details={"reason": "checkout_session_domain_mismatch"},
            )
        if str(metadata.get("company_id") or "") != str(self.company_id):
            raise ConflictError(
                "Checkout session does not belong to this company.",
                details={"reason": "checkout_session_company_mismatch"},
            )
        plan_raw = metadata.get("plan")
        plan = None
        if isinstance(plan_raw, str):
            try:
                plan = PlatformPlan(plan_raw)
            except ValueError:
                plan = None
        return BillingCheckoutSessionStatus(
            status=str(data.get("status") or "open"),
            payment_status=str(data.get("payment_status") or "unpaid"),
            plan=plan,
            checkout_session_id=session_id,
        )

    async def _upgrade_existing_subscription(
        self,
        profile: PlatformBillingProfile,
        *,
        plan: PlatformPlan,
        price_id: str,
        idempotency_key: str,
        api_key: str,
    ) -> BillingCheckoutSession:
        """Change price on the linked subscription — never create a second subscription.

        Entitlement authority:
        - Local plan/status sync from the Stripe subscription object (modify response or webhook).
        - ``is_entitled`` still requires ACTIVE/TRIALING — past_due/incomplete never grant access.
        - Uses ``payment_behavior=pending_if_incomplete`` + ``always_invoice`` so a failed
          upgrade payment leaves items unchanged (pending_update) instead of looking paid.
        """
        stripe = stripe_module(api_key=api_key)
        subscription_id = profile.stripe_subscription_id
        assert subscription_id  # guarded by caller
        try:
            remote = stripe.Subscription.retrieve(subscription_id)
            data = remote if isinstance(remote, dict) else remote.to_dict()
            items = (data.get("items") or {}).get("data") or []
            if not items:
                raise ConflictError(
                    "Existing subscription has no billable items.",
                    details={"reason": "subscription_items_missing"},
                )
            item_id = str(items[0].get("id") or "")
            if not item_id:
                raise ConflictError(
                    "Existing subscription has no billable items.",
                    details={"reason": "subscription_items_missing"},
                )
            item0 = items[0] if isinstance(items[0], dict) else {}
            current_price = (item0.get("price") or {}).get("id") if item0 else None
            # Safe retry after Stripe success + DB commit failure: already on target price
            # → sync only, do not create another proration invoice.
            if str(current_price or "") == price_id and not data.get("pending_update"):
                await self.apply_subscription_snapshot(data, event_id=None, fallback_plan=plan)
                await self.db.commit()
                return BillingCheckoutSession(
                    checkout_url=None,
                    checkout_session_id=None,
                    plan=plan,
                    mode="subscription_updated",
                )
            updated = stripe.Subscription.modify(
                subscription_id,
                items=[{"id": item_id, "price": price_id}],
                # Invoice immediately + pending updates: plan items apply only if payment succeeds.
                # See https://docs.stripe.com/billing/subscriptions/pending-updates-reference
                proration_behavior="always_invoice",
                payment_behavior="pending_if_incomplete",
                cancel_at_period_end=False,
                metadata={
                    "domain": "platform_billing",
                    "company_id": str(self.company_id),
                    "plan": plan.value,
                },
                idempotency_key=idempotency_key,
            )
        except ConflictError:
            raise
        except Exception as exc:
            logger.warning(
                "platform_subscription_upgrade_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to update the existing subscription.",
                details={"reason": "stripe_subscription_update_failed"},
            ) from None

        updated_data = updated if isinstance(updated, dict) else updated.to_dict()
        # Payment failed / requires action: Stripe did not apply item changes.
        if updated_data.get("pending_update"):
            await self.apply_subscription_snapshot(
                updated_data, event_id=None, fallback_plan=None
            )
            await self.db.commit()
            raise ConflictError(
                "Plan change requires payment. Update your payment method via the billing portal.",
                details={"reason": "subscription_upgrade_payment_required"},
            )

        await self.apply_subscription_snapshot(updated_data, event_id=None, fallback_plan=plan)
        await self.db.commit()
        # Never treat API success alone as paid access if Stripe status is not entitled.
        synced = await self.repo.get_authoritative()
        if not self.is_entitled(synced):
            raise ConflictError(
                "Subscription is not active after the plan change. Complete payment via the billing portal.",
                details={"reason": "subscription_upgrade_not_entitled", "status": synced.status.value},
            )
        return BillingCheckoutSession(
            checkout_url=None,
            checkout_session_id=None,
            plan=synced.plan,
            mode="subscription_updated",
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
