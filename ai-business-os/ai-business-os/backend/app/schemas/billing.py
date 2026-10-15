"""Schemas for NexusOS SaaS billing and tenant Stripe Checkout/Connect."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.models.enums import PlatformPlan, PlatformSubscriptionStatus, ProviderConnectionStatus
from app.schemas.base import CamelModel


class InvoiceCheckoutResponse(CamelModel):
    payment_id: uuid.UUID = Field(alias="paymentId")
    checkout_session_id: str = Field(alias="checkoutSessionId")
    checkout_url: str = Field(alias="checkoutUrl")
    amount: str
    currency: str
    reused: bool


class ConnectStatusResponse(CamelModel):
    account_id: uuid.UUID | None = Field(default=None, alias="accountId")
    external_account_id: str | None = Field(default=None, alias="externalAccountId")
    connection_status: ProviderConnectionStatus | None = Field(
        default=None, alias="connectionStatus"
    )
    charges_enabled: bool = Field(alias="chargesEnabled")
    payouts_enabled: bool = Field(alias="payoutsEnabled")
    onboarding_completed_at: str | None = Field(default=None, alias="onboardingCompletedAt")
    payments_enabled: bool = Field(alias="paymentsEnabled")


class ConnectOnboardingResponse(CamelModel):
    account_id: uuid.UUID = Field(alias="accountId")
    external_account_id: str = Field(alias="externalAccountId")
    onboarding_url: str = Field(alias="onboardingUrl")
    connection_status: ProviderConnectionStatus = Field(alias="connectionStatus")
    charges_enabled: bool = Field(alias="chargesEnabled")
    payouts_enabled: bool = Field(alias="payoutsEnabled")


class BillingStatusResponse(CamelModel):
    plan: PlatformPlan
    status: PlatformSubscriptionStatus
    entitled: bool
    cancel_at_period_end: bool = Field(alias="cancelAtPeriodEnd")
    current_period_start: datetime | None = Field(default=None, alias="currentPeriodStart")
    current_period_end: datetime | None = Field(default=None, alias="currentPeriodEnd")
    trial_ends_at: datetime | None = Field(default=None, alias="trialEndsAt")
    stripe_customer_linked: bool = Field(alias="stripeCustomerLinked")
    billing_enabled: bool = Field(alias="billingEnabled")


class BillingCheckoutRequest(CamelModel):
    plan: PlatformPlan
    """hosted = Stripe-hosted Checkout; elements = custom NexusOS Payment Element UI."""
    ui_mode: str = Field(default="hosted", alias="uiMode")


class BillingCheckoutResponse(CamelModel):
    """Checkout URL is set for hosted mode; clientSecret for elements; both null on in-place update."""

    checkout_url: str | None = Field(default=None, alias="checkoutUrl")
    checkout_session_id: str | None = Field(default=None, alias="checkoutSessionId")
    client_secret: str | None = Field(default=None, alias="clientSecret")
    publishable_key: str | None = Field(default=None, alias="publishableKey")
    plan: PlatformPlan
    mode: str = "checkout"
    ui_mode: str = Field(default="hosted", alias="uiMode")


class BillingPortalResponse(CamelModel):
    portal_url: str = Field(alias="portalUrl")


class BillingPlanPrice(CamelModel):
    """Server-derived Stripe Price snapshot — never trust client amounts."""

    plan: PlatformPlan
    price_id: str | None = Field(default=None, alias="priceId")
    currency: str | None = None
    unit_amount: int | None = Field(default=None, alias="unitAmount")
    interval: str | None = None
    interval_count: int | None = Field(default=None, alias="intervalCount")
    product_name: str | None = Field(default=None, alias="productName")
    configured: bool = False


class BillingPlansResponse(CamelModel):
    billing_enabled: bool = Field(alias="billingEnabled")
    publishable_key: str | None = Field(default=None, alias="publishableKey")
    plans: list[BillingPlanPrice]


class BillingCheckoutSessionStatusResponse(CamelModel):
    """Read-only Checkout Session status for the return page — never grants entitlements."""

    status: str
    payment_status: str = Field(alias="paymentStatus")
    plan: PlatformPlan | None = None
    checkout_session_id: str = Field(alias="checkoutSessionId")


def money_str(amount: Decimal) -> str:
    return format(amount, ".2f")
