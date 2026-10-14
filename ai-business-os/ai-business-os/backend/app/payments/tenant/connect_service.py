"""Stripe Connect onboarding for tenant invoice payment accounts."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.models.enums import ProviderConnectionStatus
from app.models.payments import PaymentProviderAccount
from app.payments.providers.stripe.client import stripe_module
from app.payments.stripe_config import require_tenant_payments_enabled
from app.repositories.payment_providers import PaymentProviderAccountRepository

logger = structlog.get_logger("payments.tenant.connect")


@dataclass(frozen=True, slots=True)
class ConnectOnboardingLink:
    account_id: uuid.UUID
    external_account_id: str
    onboarding_url: str
    connection_status: ProviderConnectionStatus
    charges_enabled: bool
    payouts_enabled: bool


@dataclass(frozen=True, slots=True)
class ConnectAccountStatus:
    account_id: uuid.UUID | None
    external_account_id: str | None
    connection_status: ProviderConnectionStatus | None
    charges_enabled: bool
    payouts_enabled: bool
    onboarding_completed_at: str | None


class TenantConnectService:
    """Express/Standard-compatible Connect account links for tenant payouts.

    Tenant invoice proceeds require a connected account with charges_enabled.
    Funds never default to the NexusOS platform Stripe balance.
    """

    def __init__(
        self,
        db: AsyncSession,
        *,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        self.db = db
        self.company_id = company_id
        self.user_id = user_id
        self.repo = PaymentProviderAccountRepository(db, company_id=company_id, user_id=user_id)

    async def get_status(self) -> ConnectAccountStatus:
        account = await self.repo.get_active_stripe()
        if account is None:
            return ConnectAccountStatus(
                account_id=None,
                external_account_id=None,
                connection_status=None,
                charges_enabled=False,
                payouts_enabled=False,
                onboarding_completed_at=None,
            )
        return ConnectAccountStatus(
            account_id=account.id,
            external_account_id=account.external_account_id,
            connection_status=account.connection_status,
            charges_enabled=account.charges_enabled,
            payouts_enabled=account.payouts_enabled,
            onboarding_completed_at=(
                account.onboarding_completed_at.isoformat()
                if account.onboarding_completed_at
                else None
            ),
        )

    async def start_onboarding(
        self,
        *,
        refresh_path: str = "/settings?connect=refresh",
        return_path: str = "/settings?connect=return",
        country: str = "US",
    ) -> ConnectOnboardingLink:
        api_key = require_tenant_payments_enabled()
        if not refresh_path.startswith("/") or not return_path.startswith("/"):
            raise ValidationError("Connect return paths must be relative.")

        stripe = stripe_module(api_key=api_key)
        existing = await self.repo.get_active_stripe()
        if existing is not None:
            external_id = existing.external_account_id
            account_row = existing
        else:
            try:
                created = stripe.Account.create(
                    type="express",
                    country=country.upper(),
                    capabilities={
                        "card_payments": {"requested": True},
                        "transfers": {"requested": True},
                    },
                    metadata={"company_id": str(self.company_id), "domain": "tenant_payments"},
                    idempotency_key=f"connect-account:{self.company_id}",
                )
            except Exception as exc:
                logger.warning(
                    "connect_account_create_failed",
                    company_id=str(self.company_id),
                    error_type=type(exc).__name__,
                )
                raise ConflictError(
                    "Unable to create a Stripe Connect account.",
                    details={"reason": "stripe_connect_account_create_failed"},
                ) from None
            external_id = created["id"] if isinstance(created, dict) else created.id
            account_row = await self.repo.upsert_pending_stripe(external_account_id=external_id)

        frontend = settings.FRONTEND_URL.rstrip("/")
        try:
            link = stripe.AccountLink.create(
                account=external_id,
                refresh_url=f"{frontend}{refresh_path}",
                return_url=f"{frontend}{return_path}",
                type="account_onboarding",
            )
        except Exception as exc:
            logger.warning(
                "connect_account_link_failed",
                company_id=str(self.company_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to start Stripe Connect onboarding.",
                details={"reason": "stripe_connect_link_failed"},
            ) from None

        url = link["url"] if isinstance(link, dict) else link.url
        return ConnectOnboardingLink(
            account_id=account_row.id,
            external_account_id=external_id,
            onboarding_url=str(url),
            connection_status=account_row.connection_status,
            charges_enabled=account_row.charges_enabled,
            payouts_enabled=account_row.payouts_enabled,
        )

    async def sync_account(self, account: PaymentProviderAccount) -> PaymentProviderAccount:
        api_key = require_tenant_payments_enabled()
        stripe = stripe_module(api_key=api_key)
        remote = stripe.Account.retrieve(account.external_account_id)
        charges = bool(
            remote.get("charges_enabled")
            if isinstance(remote, dict)
            else getattr(remote, "charges_enabled", False)
        )
        payouts = bool(
            remote.get("payouts_enabled")
            if isinstance(remote, dict)
            else getattr(remote, "payouts_enabled", False)
        )
        details = bool(
            remote.get("details_submitted")
            if isinstance(remote, dict)
            else getattr(remote, "details_submitted", False)
        )
        return await self.repo.apply_stripe_account_snapshot(
            account,
            charges_enabled=charges,
            payouts_enabled=payouts,
            details_submitted=details,
        )
