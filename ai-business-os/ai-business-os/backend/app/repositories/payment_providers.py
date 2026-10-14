"""Tenant-scoped payment provider account persistence."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.enums import PaymentProviderKind, ProviderConnectionStatus
from app.models.payments import PaymentProviderAccount


class PaymentProviderAccountRepository:
    def __init__(self, db: AsyncSession, *, company_id: uuid.UUID, user_id: uuid.UUID | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    async def get_active_stripe(self) -> PaymentProviderAccount | None:
        return (
            await self.db.execute(
                select(PaymentProviderAccount).where(
                    PaymentProviderAccount.company_id == self.company_id,
                    PaymentProviderAccount.provider == PaymentProviderKind.STRIPE,
                    PaymentProviderAccount.disconnected_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def require_chargeable_stripe(self) -> PaymentProviderAccount:
        account = await self.get_active_stripe()
        if (
            account is None
            or account.connection_status != ProviderConnectionStatus.ACTIVE
            or not account.charges_enabled
        ):
            raise ConflictError(
                "Stripe Connect is not ready to accept invoice payments.",
                details={"reason": "stripe_connect_not_ready"},
            )
        return account

    async def get_by_external_id(
        self, external_account_id: str
    ) -> PaymentProviderAccount | None:
        return (
            await self.db.execute(
                select(PaymentProviderAccount).where(
                    PaymentProviderAccount.provider == PaymentProviderKind.STRIPE,
                    PaymentProviderAccount.external_account_id == external_account_id,
                )
            )
        ).scalar_one_or_none()

    async def get_for_company(self, account_id: uuid.UUID) -> PaymentProviderAccount:
        account = (
            await self.db.execute(
                select(PaymentProviderAccount).where(
                    PaymentProviderAccount.id == account_id,
                    PaymentProviderAccount.company_id == self.company_id,
                    PaymentProviderAccount.disconnected_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if account is None:
            raise NotFoundError("Payment provider account not found")
        return account

    async def upsert_pending_stripe(self, *, external_account_id: str) -> PaymentProviderAccount:
        existing = await self.get_active_stripe()
        now = datetime.now(UTC)
        if existing is not None:
            existing.external_account_id = external_account_id
            existing.connection_status = ProviderConnectionStatus.ONBOARDING
            existing.charges_enabled = False
            existing.payouts_enabled = False
            existing.last_synced_at = now
            await self.db.flush()
            return existing
        account = PaymentProviderAccount(
            company_id=self.company_id,
            provider=PaymentProviderKind.STRIPE,
            external_account_id=external_account_id,
            connection_status=ProviderConnectionStatus.ONBOARDING,
            charges_enabled=False,
            payouts_enabled=False,
            last_synced_at=now,
        )
        self.db.add(account)
        await self.db.flush()
        return account

    async def apply_stripe_account_snapshot(
        self,
        account: PaymentProviderAccount,
        *,
        charges_enabled: bool,
        payouts_enabled: bool,
        details_submitted: bool,
    ) -> PaymentProviderAccount:
        account.charges_enabled = charges_enabled
        account.payouts_enabled = payouts_enabled
        account.last_synced_at = datetime.now(UTC)
        if charges_enabled and details_submitted:
            account.connection_status = ProviderConnectionStatus.ACTIVE
            if account.onboarding_completed_at is None:
                account.onboarding_completed_at = account.last_synced_at
        elif details_submitted:
            account.connection_status = ProviderConnectionStatus.RESTRICTED
        else:
            account.connection_status = ProviderConnectionStatus.ONBOARDING
        await self.db.flush()
        return account

    async def flush(self) -> None:
        await self.db.flush()
