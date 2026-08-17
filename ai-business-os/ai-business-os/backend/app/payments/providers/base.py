"""Provider-neutral payment domain types and interfaces."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class ProviderAccountRef:
    provider: str
    external_account_id: str
    company_id: UUID
    internal_id: UUID


@dataclass(frozen=True, slots=True)
class ProviderPaymentInitiation:
    provider_payment_id: str | None
    checkout_session_id: str | None
    checkout_url: str | None
    status: str


@dataclass(frozen=True, slots=True)
class ProviderPaymentSnapshot:
    provider_payment_id: str
    amount: Decimal
    currency: str
    status: str
    confirmed_at: datetime | None


@dataclass(frozen=True, slots=True)
class ProviderRefundSnapshot:
    provider_refund_id: str
    amount: Decimal
    status: str


@dataclass(frozen=True, slots=True)
class ProviderWebhookEvent:
    external_event_id: str
    event_type: str
    provider_account_ref: str | None
    payload_hash: str | None


class TenantPaymentProvider(Protocol):
    provider_name: str

    async def create_checkout_for_invoice(
        self,
        *,
        provider_account: ProviderAccountRef,
        invoice_id: UUID,
        amount: Decimal,
        currency: str,
        idempotency_key: str,
    ) -> ProviderPaymentInitiation: ...

    async def retrieve_payment(
        self,
        *,
        provider_account: ProviderAccountRef,
        provider_payment_id: str,
    ) -> ProviderPaymentSnapshot: ...

    async def refund_payment(
        self,
        *,
        provider_account: ProviderAccountRef,
        provider_payment_id: str,
        amount: Decimal,
        idempotency_key: str,
    ) -> ProviderRefundSnapshot: ...

    def verify_webhook(
        self,
        *,
        payload: bytes,
        signature_header: str,
        webhook_secret: str,
    ) -> ProviderWebhookEvent: ...


class PlatformBillingProvider(Protocol):
    """Separate interface for NexusOS SaaS subscription billing."""

    async def create_checkout_session(self, *, company_id: UUID, price_id: str, idempotency_key: str) -> str: ...

    async def create_billing_portal_session(self, *, stripe_customer_id: str) -> str: ...

    def verify_webhook(
        self,
        *,
        payload: bytes,
        signature_header: str,
        webhook_secret: str,
    ) -> ProviderWebhookEvent: ...
