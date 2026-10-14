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


class BillingCheckoutResponse(CamelModel):
    """Checkout URL is set for new subscriptions; null when an existing sub was updated."""

    checkout_url: str | None = Field(default=None, alias="checkoutUrl")
    checkout_session_id: str | None = Field(default=None, alias="checkoutSessionId")
    plan: PlatformPlan
    mode: str = "checkout"


class BillingPortalResponse(CamelModel):
    portal_url: str = Field(alias="portalUrl")


def money_str(amount: Decimal) -> str:
    return format(amount, ".2f")
