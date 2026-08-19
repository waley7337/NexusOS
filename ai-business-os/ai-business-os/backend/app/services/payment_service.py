"""Authoritative tenant-finance payment state and balance operations."""
from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.exceptions import ConflictError, ValidationError
from app.models.enums import InvoiceStatus, PaymentMethod, PaymentSource, PaymentStatus
from app.models.finance import Invoice, Payment
from app.payments.currency import normalize_currency
from app.payments.money import effective_payment_amount, quantize_money
from app.repositories.payments import PaymentRepository

_PAYMENT_ELIGIBLE = frozenset({InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE})


class PaymentService:
    def __init__(self, repository: PaymentRepository, *, clock: Callable[[], datetime] | None = None):
        self.repo = repository
        self.clock = clock or (lambda: datetime.now(UTC))

    @staticmethod
    def amount_paid(payments: list[Payment]) -> Decimal:
        return quantize_money(sum((effective_payment_amount(
            status=row.status, amount=row.amount, refunded_amount=row.refunded_amount
        ) for row in payments), start=Decimal("0")))

    async def _operation_date(self, now: datetime) -> date:
        try:
            return now.astimezone(ZoneInfo(await self.repo.company_timezone())).date()
        except ZoneInfoNotFoundError as exc:
            raise ValidationError("Company timezone is invalid.") from exc

    @staticmethod
    def _derive_invoice_status(invoice: Invoice, paid: Decimal, operation_date: date) -> None:
        paid = quantize_money(paid)
        total = quantize_money(invoice.total)
        if paid < 0 or paid > total:
            raise ConflictError("Invoice payment balance is invalid.")
        if paid == total:
            invoice.status = InvoiceStatus.PAID
        elif paid > 0:
            invoice.status = InvoiceStatus.PARTIALLY_PAID
        elif invoice.due_date < operation_date:
            invoice.status = InvoiceStatus.OVERDUE
        else:
            invoice.status = InvoiceStatus.SENT

    async def record_manual_payment(
        self, *, invoice_id: uuid.UUID, amount: Decimal, currency: str,
        payment_method: PaymentMethod, payment_date: date, notes: str | None = None,
        idempotency_key: str | None = None,
    ) -> Payment:
        now = self.clock()
        invoice = await self.repo.lock_invoice(invoice_id)
        if invoice.status not in _PAYMENT_ELIGIBLE:
            raise ConflictError(
                "Invoice cannot accept a payment in its current status.",
                details={"reason": "invoice_not_payment_eligible"},
            )
        try:
            normalized_amount = quantize_money(Decimal(str(amount)))
        except (ValueError, ArithmeticError) as exc:
            raise ValidationError("Payment amount must be a finite number.") from exc
        if normalized_amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")
        try:
            normalized_currency = normalize_currency(currency)
        except ValueError as exc:
            raise ValidationError("Payment currency is invalid.") from exc
        if normalized_currency != invoice.currency:
            raise ValidationError(
                "Payment currency must match invoice currency.",
                details={"reason": "payment_currency_mismatch"},
            )
        operation_date = await self._operation_date(now)
        if payment_date > operation_date:
            raise ValidationError(
                "Payment date cannot be in the future.",
                details={"reason": "payment_date_in_future"},
            )
        payments = await self.repo.active_payments(invoice.id)
        paid = self.amount_paid(payments)
        remaining = quantize_money(invoice.total - paid)
        if normalized_amount > remaining:
            raise ConflictError(
                "Payment amount exceeds the invoice balance.",
                details={"reason": "payment_exceeds_invoice_balance"},
            )
        payment = Payment(
            invoice_id=invoice.id,
            payment_method=payment_method,
            amount=normalized_amount,
            payment_date=payment_date,
            status=PaymentStatus.COMPLETED,
            currency=normalized_currency,
            source=PaymentSource.MANUAL,
            refunded_amount=Decimal("0.00"),
            confirmed_at=now,
            confirmed_by=self.repo.user_id,
            notes=notes,
            idempotency_key=idempotency_key,
        )
        await self.repo.add(payment)
        self._derive_invoice_status(invoice, paid + normalized_amount, operation_date)
        await self.repo.flush()
        return payment

    async def refund_manual_payment(
        self, *, payment_id: uuid.UUID, amount: Decimal, reason: str,
    ) -> Payment:
        reason = reason.strip()
        if not reason:
            raise ValidationError("Refund reason is required.")
        try:
            refund_amount = quantize_money(Decimal(str(amount)))
        except (ValueError, ArithmeticError) as exc:
            raise ValidationError("Refund amount must be a finite number.") from exc
        if refund_amount <= 0:
            raise ValidationError("Refund amount must be greater than zero.")
        invoice_id = await self.repo.payment_invoice_id(payment_id)
        invoice = await self.repo.lock_invoice(invoice_id)
        payment = await self.repo.lock_payment(payment_id, invoice.id)
        if payment.status != PaymentStatus.COMPLETED:
            raise ConflictError(
                "Only completed payments can be refunded.",
                details={"reason": "payment_not_manually_refundable"},
            )
        if payment.source != PaymentSource.MANUAL:
            raise ConflictError(
                "Only manual payments can be manually refunded.",
                details={"reason": "payment_not_manually_refundable"},
            )
        payments = await self.repo.active_payments(invoice.id)
        paid_before = self.amount_paid(payments)
        new_refunded = quantize_money(payment.refunded_amount + refund_amount)
        if new_refunded > quantize_money(payment.amount):
            raise ConflictError(
                "Refund amount exceeds the refundable balance.",
                details={"reason": "refund_exceeds_refundable_balance"},
            )
        now = self.clock()
        payment.refunded_amount = new_refunded
        payment.refunded_at = now
        payment.refunded_by = self.repo.user_id
        payment.refund_reason = reason
        payment.updated_by = self.repo.user_id
        if new_refunded == quantize_money(payment.amount):
            payment.status = PaymentStatus.REFUNDED
        self._derive_invoice_status(invoice, paid_before - refund_amount, await self._operation_date(now))
        await self.repo.flush()
        await self.repo.refresh(payment)
        return payment
