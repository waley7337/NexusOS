"""Tenant-scoped persistence and canonical row locks for payments."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, TenantIsolationError
from app.models.company import Company
from app.models.enums import PaymentSource, PaymentStatus
from app.models.finance import Invoice, Payment


class PaymentRepository:
    def __init__(
        self,
        db: AsyncSession,
        *,
        company_id: uuid.UUID,
        user_id: uuid.UUID | None = None,
    ):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    async def company_timezone(self) -> str:
        value = await self.db.scalar(select(Company.timezone).where(Company.id == self.company_id))
        if value is None:
            raise TenantIsolationError()
        return str(value)

    async def ensure_invoice_exists(self, invoice_id: uuid.UUID) -> None:
        value = await self.db.scalar(
            select(Invoice.id).where(
                Invoice.id == invoice_id,
                Invoice.company_id == self.company_id,
                Invoice.deleted_at.is_(None),
                Invoice.is_active.is_(True),
            )
        )
        if value is None:
            raise NotFoundError("Invoice not found")

    async def get_payment(self, payment_id: uuid.UUID) -> Payment:
        payment = (
            await self.db.execute(
                select(Payment).where(
                    Payment.id == payment_id,
                    Payment.company_id == self.company_id,
                    Payment.deleted_at.is_(None),
                    Payment.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if payment is None:
            raise NotFoundError("Payment not found")
        return payment

    async def list_for_invoice(
        self,
        invoice_id: uuid.UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[Payment], int]:
        await self.ensure_invoice_exists(invoice_id)
        filters = (
            Payment.invoice_id == invoice_id,
            Payment.company_id == self.company_id,
            Payment.deleted_at.is_(None),
            Payment.is_active.is_(True),
        )
        total = int(
            await self.db.scalar(select(func.count()).select_from(Payment).where(*filters))
            or 0
        )
        rows = await self.db.scalars(
            select(Payment)
            .where(*filters)
            .order_by(Payment.payment_date.desc(), Payment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(rows.all()), total

    async def lock_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        stmt = select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.company_id == self.company_id,
            Invoice.deleted_at.is_(None),
            Invoice.is_active.is_(True),
        ).with_for_update()
        invoice = (await self.db.execute(stmt)).scalar_one_or_none()
        if invoice is None:
            raise NotFoundError("Invoice not found")
        return invoice

    async def payment_invoice_id(self, payment_id: uuid.UUID) -> uuid.UUID:
        value = await self.db.scalar(select(Payment.invoice_id).where(
            Payment.id == payment_id,
            Payment.company_id == self.company_id,
            Payment.deleted_at.is_(None),
            Payment.is_active.is_(True),
        ))
        if value is None:
            raise NotFoundError("Payment not found")
        return value

    async def lock_payment(self, payment_id: uuid.UUID, invoice_id: uuid.UUID) -> Payment:
        stmt = select(Payment).where(
            Payment.id == payment_id,
            Payment.invoice_id == invoice_id,
            Payment.company_id == self.company_id,
            Payment.deleted_at.is_(None),
            Payment.is_active.is_(True),
        ).with_for_update()
        payment = (await self.db.execute(stmt)).scalar_one_or_none()
        if payment is None:
            raise NotFoundError("Payment not found")
        return payment

    async def active_payments(self, invoice_id: uuid.UUID) -> list[Payment]:
        rows = await self.db.scalars(select(Payment).where(
            Payment.invoice_id == invoice_id,
            Payment.company_id == self.company_id,
            Payment.deleted_at.is_(None),
            Payment.is_active.is_(True),
        ))
        return list(rows.all())

    async def add(self, payment: Payment) -> Payment:
        payment.company_id = self.company_id
        if self.user_id is not None:
            payment.created_by = self.user_id
            payment.updated_by = self.user_id
        self.db.add(payment)
        await self.db.flush()
        return payment

    async def flush(self) -> None:
        await self.db.flush()

    async def refresh(self, payment: Payment) -> None:
        await self.db.refresh(payment)

    async def find_pending_provider_for_invoice(self, invoice_id: uuid.UUID) -> Payment | None:
        return (
            await self.db.execute(
                select(Payment)
                .where(
                    Payment.invoice_id == invoice_id,
                    Payment.company_id == self.company_id,
                    Payment.source == PaymentSource.PROVIDER,
                    Payment.status == PaymentStatus.PENDING,
                    Payment.deleted_at.is_(None),
                    Payment.is_active.is_(True),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()

    async def find_by_checkout_session(self, checkout_session_id: str) -> Payment | None:
        return (
            await self.db.execute(
                select(Payment).where(
                    Payment.company_id == self.company_id,
                    Payment.provider_checkout_session_id == checkout_session_id,
                    Payment.deleted_at.is_(None),
                    Payment.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()

    async def find_by_provider_payment_id(self, provider_payment_id: str) -> Payment | None:
        return (
            await self.db.execute(
                select(Payment).where(
                    Payment.company_id == self.company_id,
                    Payment.provider_payment_id == provider_payment_id,
                    Payment.deleted_at.is_(None),
                    Payment.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()

    async def lock_payment_by_id(self, payment_id: uuid.UUID) -> Payment:
        payment = (
            await self.db.execute(
                select(Payment)
                .where(
                    Payment.id == payment_id,
                    Payment.company_id == self.company_id,
                    Payment.deleted_at.is_(None),
                    Payment.is_active.is_(True),
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if payment is None:
            raise NotFoundError("Payment not found")
        return payment
