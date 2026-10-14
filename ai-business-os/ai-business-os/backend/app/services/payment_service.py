"""Authoritative tenant-finance payment state and balance operations."""
from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.exceptions import ConflictError, ValidationError
from app.models.enums import (
    InvoiceStatus,
    PaymentMethod,
    PaymentProviderKind,
    PaymentSource,
    PaymentStatus,
)
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

    async def outstanding_for_checkout(
        self, invoice_id: uuid.UUID
    ) -> tuple[Invoice, Decimal, str]:
        """Lock invoice and return (invoice, outstanding, currency) for Checkout."""
        invoice = await self.repo.lock_invoice(invoice_id)
        if invoice.status not in _PAYMENT_ELIGIBLE:
            raise ConflictError(
                "Invoice cannot accept a payment in its current status.",
                details={"reason": "invoice_not_payment_eligible"},
            )
        payments = await self.repo.active_payments(invoice.id)
        paid = self.amount_paid(payments)
        remaining = quantize_money(invoice.total - paid)
        if remaining <= 0:
            raise ConflictError(
                "Invoice has no outstanding balance.",
                details={"reason": "invoice_already_paid"},
            )
        return invoice, remaining, invoice.currency

    async def create_pending_provider_payment(
        self,
        *,
        invoice: Invoice,
        amount: Decimal,
        currency: str,
        provider_account_id: uuid.UUID,
        idempotency_key: str | None = None,
    ) -> Payment:
        pending = await self.repo.find_pending_provider_for_invoice(invoice.id)
        if pending is not None:
            raise ConflictError(
                "A Stripe checkout is already in progress for this invoice.",
                details={
                    "reason": "checkout_already_pending",
                    "paymentId": str(pending.id),
                },
            )
        now = self.clock()
        payment = Payment(
            invoice_id=invoice.id,
            payment_method=PaymentMethod.STRIPE,
            amount=quantize_money(amount),
            payment_date=await self._operation_date(now),
            status=PaymentStatus.PENDING,
            currency=normalize_currency(currency),
            source=PaymentSource.PROVIDER,
            provider=PaymentProviderKind.STRIPE,
            provider_account_id=provider_account_id,
            refunded_amount=Decimal("0.00"),
            idempotency_key=idempotency_key,
        )
        await self.repo.add(payment)
        return payment

    async def attach_checkout_session(
        self,
        *,
        payment_id: uuid.UUID,
        checkout_session_id: str,
        provider_payment_id: str | None = None,
    ) -> Payment:
        payment = await self.repo.lock_payment_by_id(payment_id)
        if payment.status != PaymentStatus.PENDING or payment.source != PaymentSource.PROVIDER:
            raise ConflictError(
                "Payment is not awaiting checkout.",
                details={"reason": "payment_not_pending_checkout"},
            )
        payment.provider_checkout_session_id = checkout_session_id
        if provider_payment_id:
            payment.provider_payment_id = provider_payment_id
        if self.repo.user_id is not None:
            payment.updated_by = self.repo.user_id
        await self.repo.flush()
        return payment

    async def confirm_provider_payment(
        self,
        *,
        payment_id: uuid.UUID,
        amount: Decimal,
        currency: str,
        provider_payment_id: str | None,
        checkout_session_id: str | None = None,
    ) -> Payment:
        invoice_id = await self.repo.payment_invoice_id(payment_id)
        invoice = await self.repo.lock_invoice(invoice_id)
        payment = await self.repo.lock_payment(payment_id, invoice.id)

        if payment.status == PaymentStatus.COMPLETED:
            return payment
        if payment.status not in {PaymentStatus.PENDING, PaymentStatus.FAILED}:
            raise ConflictError(
                "Payment cannot be confirmed in its current status.",
                details={"reason": "payment_not_confirmable"},
            )

        normalized_amount = quantize_money(amount)
        normalized_currency = normalize_currency(currency)
        if normalized_currency != invoice.currency or normalized_currency != payment.currency:
            raise ConflictError(
                "Provider payment currency does not match the invoice.",
                details={"reason": "payment_currency_mismatch"},
            )
        if normalized_amount != quantize_money(payment.amount):
            raise ConflictError(
                "Provider payment amount does not match the checkout attempt.",
                details={"reason": "payment_amount_mismatch"},
            )

        payments = await self.repo.active_payments(invoice.id)
        others = [row for row in payments if row.id != payment.id]
        paid = self.amount_paid(others)
        remaining = quantize_money(invoice.total - paid)
        if normalized_amount > remaining:
            raise ConflictError(
                "Provider payment would overpay the invoice.",
                details={"reason": "payment_exceeds_invoice_balance"},
            )

        now = self.clock()
        payment.amount = normalized_amount
        payment.status = PaymentStatus.COMPLETED
        payment.failure_code = None
        payment.failure_message = None
        payment.confirmed_at = now
        payment.confirmed_by = self.repo.user_id
        if provider_payment_id:
            payment.provider_payment_id = provider_payment_id
        if checkout_session_id:
            payment.provider_checkout_session_id = checkout_session_id
        if self.repo.user_id is not None:
            payment.updated_by = self.repo.user_id
        self._derive_invoice_status(
            invoice, paid + normalized_amount, await self._operation_date(now)
        )
        await self.repo.flush()
        await self.repo.refresh(payment)
        return payment

    async def fail_provider_payment(
        self,
        *,
        payment_id: uuid.UUID,
        failure_code: str | None = None,
        failure_message: str | None = None,
    ) -> Payment:
        payment = await self.repo.lock_payment_by_id(payment_id)
        # Late failure/expiry webhooks must not undo a confirmed payment or
        # force Stripe into infinite 5xx retries (ConflictError → 500).
        if payment.status in {PaymentStatus.COMPLETED, PaymentStatus.REFUNDED}:
            return payment
        if payment.status == PaymentStatus.FAILED:
            return payment
        payment.status = PaymentStatus.FAILED
        payment.failure_code = (failure_code or "provider_failed")[:100]
        payment.failure_message = (failure_message or "Payment failed.")[:500]
        if self.repo.user_id is not None:
            payment.updated_by = self.repo.user_id
        await self.repo.flush()
        return payment

    async def apply_provider_refund(
        self,
        *,
        payment_id: uuid.UUID,
        refund_amount: Decimal,
        provider_refund_id: str | None = None,
        reason: str | None = None,
    ) -> Payment:
        invoice_id = await self.repo.payment_invoice_id(payment_id)
        invoice = await self.repo.lock_invoice(invoice_id)
        payment = await self.repo.lock_payment(payment_id, invoice.id)
        if payment.source != PaymentSource.PROVIDER:
            raise ConflictError(
                "Only provider payments can receive provider refunds.",
                details={"reason": "payment_not_provider"},
            )
        if payment.status not in {PaymentStatus.COMPLETED, PaymentStatus.REFUNDED}:
            raise ConflictError(
                "Only completed provider payments can be refunded.",
                details={"reason": "payment_not_refundable"},
            )
        amount = quantize_money(refund_amount)
        if amount <= 0:
            raise ValidationError("Refund amount must be greater than zero.")
        payments = await self.repo.active_payments(invoice.id)
        paid_before = self.amount_paid(payments)
        new_refunded = quantize_money(payment.refunded_amount + amount)
        if new_refunded > quantize_money(payment.amount):
            raise ConflictError(
                "Refund amount exceeds the refundable balance.",
                details={"reason": "refund_exceeds_refundable_balance"},
            )
        now = self.clock()
        payment.refunded_amount = new_refunded
        payment.refunded_at = now
        payment.refund_reason = (reason or "stripe_refund")[:500]
        if provider_refund_id:
            payment.provider_refund_id = provider_refund_id
        if new_refunded == quantize_money(payment.amount):
            payment.status = PaymentStatus.REFUNDED
        self._derive_invoice_status(
            invoice, paid_before - amount, await self._operation_date(now)
        )
        await self.repo.flush()
        await self.repo.refresh(payment)
        return payment
