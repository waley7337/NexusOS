"""Payment infrastructure — provider accounts, webhook events, idempotency.

Separate from tenant Finance documents (Invoice/Payment in finance.py) and
Platform Billing profiles. Never stores provider secrets or card data.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin
from app.models.enums import (
    PaymentProviderKind,
    PlatformPlan,
    PlatformSubscriptionStatus,
    ProviderConnectionStatus,
    WebhookDomain,
    WebhookProcessingStatus,
)

if TYPE_CHECKING:
    from app.models.company import Company


class PaymentProviderAccount(Base, TenantMixin, TimestampMixin):
    """Tenant-connected payment provider (Stripe Connect first)."""

    __tablename__ = "payment_provider_accounts"
    __table_args__ = (
        Index(
            "ix_payment_provider_accounts_company_provider_active_uq",
            "company_id",
            "provider",
            unique=True,
            postgresql_where=text("disconnected_at IS NULL"),
        ),
        UniqueConstraint(
            "provider",
            "external_account_id",
            name="uq_payment_provider_accounts_provider_external",
        ),
        UniqueConstraint("id", "company_id", name="uq_payment_provider_accounts_id_company"),
    )

    provider: Mapped[PaymentProviderKind] = mapped_column(
        Enum(PaymentProviderKind, native_enum=False, length=20),
        nullable=False,
    )
    external_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    connection_status: Mapped[ProviderConnectionStatus] = mapped_column(
        Enum(ProviderConnectionStatus, native_enum=False, length=20),
        default=ProviderConnectionStatus.PENDING,
        nullable=False,
    )
    charges_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    payouts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )
    disconnected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )


class ProviderWebhookEvent(Base, TimestampMixin):
    """Append-only webhook receipt log — deduplicated by provider + event id."""

    __tablename__ = "provider_webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "external_event_id", name="uq_provider_webhook_events_provider_event"),
        Index("ix_provider_webhook_events_company", "company_id"),
        Index("ix_provider_webhook_events_status", "processing_status"),
    )

    provider: Mapped[PaymentProviderKind] = mapped_column(
        Enum(PaymentProviderKind, native_enum=False, length=20),
        nullable=False,
    )
    domain: Mapped[WebhookDomain] = mapped_column(
        Enum(WebhookDomain, native_enum=False, length=30),
        nullable=False,
    )
    external_event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_account_ref: Mapped[str | None] = mapped_column(String(255))
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
    )
    processing_status: Mapped[WebhookProcessingStatus] = mapped_column(
        Enum(WebhookProcessingStatus, native_enum=False, length=20),
        default=WebhookProcessingStatus.RECEIVED,
        nullable=False,
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(String(500))
    payload_hash: Mapped[str | None] = mapped_column(String(64))


class IdempotencyRecord(Base, TenantMixin, TimestampMixin):
    """Tenant-scoped idempotency store for financial side effects."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "scope",
            "idempotency_key",
            name="uq_idempotency_records_company_scope_key",
        ),
        Index("ix_idempotency_records_expires_at", "expires_at"),
    )

    scope: Mapped[str] = mapped_column(String(80), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    request_hash: Mapped[str | None] = mapped_column(String(64))
    result_entity_type: Mapped[str | None] = mapped_column(String(80))
    result_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PlatformBillingProfile(Base, TimestampMixin):
    """NexusOS SaaS subscription state — 1:1 with Company."""

    __tablename__ = "platform_billing_profiles"
    __table_args__ = (
        UniqueConstraint("company_id", name="uq_platform_billing_profiles_company_id"),
        UniqueConstraint("stripe_customer_id", name="uq_platform_billing_profiles_stripe_customer"),
        UniqueConstraint("stripe_subscription_id", name="uq_platform_billing_profiles_stripe_subscription"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255))
    stripe_price_id: Mapped[str | None] = mapped_column(String(255))
    plan: Mapped[PlatformPlan] = mapped_column(
        Enum(PlatformPlan, native_enum=False, length=20),
        default=PlatformPlan.FREE,
        nullable=False,
    )
    status: Mapped[PlatformSubscriptionStatus] = mapped_column(
        Enum(PlatformSubscriptionStatus, native_enum=False, length=20),
        default=PlatformSubscriptionStatus.NO_SUBSCRIPTION,
        nullable=False,
    )
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_webhook_event_id: Mapped[str | None] = mapped_column(String(255))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    company: Mapped["Company"] = relationship(back_populates="platform_billing_profile")
