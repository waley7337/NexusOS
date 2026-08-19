"""Tenant-scoped persistence and canonical row locks for payments."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, TenantIsolationError
from app.models.company import Company
from app.models.finance import Invoice, Payment


class PaymentRepository:
    def __init__(self, db: AsyncSession, *, company_id: uuid.UUID, user_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    async def company_timezone(self) -> str:
        value = await self.db.scalar(select(Company.timezone).where(Company.id == self.company_id))
        if value is None:
            raise TenantIsolationError()
        return str(value)

    async def lock_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        stmt = select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.company_id == self.company_id,
            Invoice.deleted_at.is_(None),
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
        payment.created_by = self.user_id
        payment.updated_by = self.user_id
        self.db.add(payment)
        await self.db.flush()
        return payment

    async def flush(self) -> None:
        await self.db.flush()
