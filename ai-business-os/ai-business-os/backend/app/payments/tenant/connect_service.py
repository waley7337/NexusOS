"""Stripe Connect onboarding for tenant invoice payment accounts."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ServiceUnavailableError, ValidationError
from app.models.company import Company
from app.models.enums import ProviderConnectionStatus
from app.models.payments import PaymentProviderAccount
from app.models.user import User
from app.payments.providers.stripe.client import stripe_client, stripe_module
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


def _stripe_error_message(exc: BaseException) -> str:
    return str(getattr(exc, "user_message", None) or exc)


def _raise_connect_create_failure(*, company_id: uuid.UUID, exc: BaseException) -> None:
    """Map Stripe create failures to stable API reasons (no secret leakage)."""
    message = _stripe_error_message(exc)
    lowered = message.lower()
    code = getattr(exc, "code", None)
    logger.warning(
        "connect_account_create_failed",
        company_id=str(company_id),
        error_type=type(exc).__name__,
        stripe_code=code,
        stripe_message=message[:240],
    )
    if (
        "signed up for connect" in lowered
        or "enable connect" in lowered
        or "enable_connect" in lowered
    ):
        raise ServiceUnavailableError(
            "Stripe Connect is not enabled on the platform account.",
            details={"reason": "stripe_connect_platform_not_enabled"},
        ) from None
    if (
        code == "account_creation_liability_unacknowledged"
        or "platform-profile" in lowered
        or "responsibilities of managing losses" in lowered
    ):
        raise ServiceUnavailableError(
            "Stripe Connect platform profile is incomplete.",
            details={"reason": "stripe_connect_platform_profile_incomplete"},
        ) from None
    raise ConflictError(
        "Unable to create a Stripe Connect account.",
        details={"reason": "stripe_connect_account_create_failed"},
    ) from None


class TenantConnectService:
    """Express-compatible Connect onboarding for tenant invoice payouts.

    New Connect platforms (API 2026-03-25.dahlia+) must create connected
    accounts via Accounts v2. Account Links and status sync still use the
    v1 surfaces Stripe documents as interoperable with v2 account IDs.

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

    async def _contact_profile(self) -> tuple[str, str]:
        """Resolve Connect contact email + display name from tenant records."""
        user = (
            await self.db.execute(select(User).where(User.id == self.user_id))
        ).scalar_one_or_none()
        company = (
            await self.db.execute(select(Company).where(Company.id == self.company_id))
        ).scalar_one_or_none()
        contact_email = (
            (user.email.strip() if user and user.email else "")
            or (company.email.strip() if company and company.email else "")
        )
        if not contact_email:
            raise ValidationError(
                "A contact email is required before connecting Stripe.",
                details={"reason": "connect_contact_email_missing"},
            )
        display_name = (
            company.name.strip()
            if company and company.name and company.name.strip()
            else "Company"
        )
        return contact_email, display_name

    def _create_connected_account(
        self,
        *,
        api_key: str,
        country: str,
        contact_email: str,
        display_name: str,
    ) -> str:
        """Create an Express-equivalent connected account via Accounts v2."""
        client = stripe_client(api_key=api_key)
        country_code = country.upper()
        try:
            created: Any = client.raw_request(
                "post",
                "/v2/core/accounts",
                contact_email=contact_email,
                display_name=display_name,
                dashboard="express",
                identity={"country": country_code},
                configuration={
                    "merchant": {
                        "capabilities": {
                            "card_payments": {"requested": True},
                        }
                    },
                    "recipient": {
                        "capabilities": {
                            "stripe_balance": {
                                "stripe_transfers": {"requested": True},
                            }
                        }
                    },
                },
                defaults={
                    "currency": "usd",
                    "responsibilities": {
                        "fees_collector": "application",
                        "losses_collector": "application",
                    },
                },
                metadata={
                    "company_id": str(self.company_id),
                    "domain": "tenant_payments",
                },
                include=[
                    "configuration.merchant",
                    "configuration.recipient",
                    "identity",
                    "requirements",
                ],
                idempotency_key=f"connect-account:{self.company_id}",
            )
        except Exception as exc:
            _raise_connect_create_failure(company_id=self.company_id, exc=exc)

        if isinstance(created, dict):
            account_id = created.get("id")
        else:
            account_id = getattr(created, "id", None)
        if not account_id or not str(account_id).startswith("acct_"):
            logger.warning(
                "connect_account_create_missing_id",
                company_id=str(self.company_id),
            )
            raise ConflictError(
                "Unable to create a Stripe Connect account.",
                details={"reason": "stripe_connect_account_create_failed"},
            )
        return str(account_id)

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
            contact_email, display_name = await self._contact_profile()
            external_id = self._create_connected_account(
                api_key=api_key,
                country=country,
                contact_email=contact_email,
                display_name=display_name,
            )
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
                stripe_code=getattr(exc, "code", None),
                stripe_message=_stripe_error_message(exc)[:240],
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
