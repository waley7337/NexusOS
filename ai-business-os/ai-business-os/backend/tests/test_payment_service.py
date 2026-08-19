"""Focused internal authority tests for Part 08.4.1 (no HTTP surface)."""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.enums import InvoiceStatus, PaymentMethod, PaymentSource, PaymentStatus
from app.models.finance import Invoice, Payment
from app.services.payment_service import PaymentService

NOW = datetime(2026, 8, 18, 22, 30, tzinfo=UTC)


def invoice(*, status: InvoiceStatus = InvoiceStatus.SENT, total: str = "100.00", due: date = date(2026, 8, 31)) -> Invoice:
    return Invoice(
        id=uuid.uuid4(), company_id=uuid.uuid4(), customer_id=uuid.uuid4(),
        invoice_number="INV-1", issue_date=date(2026, 8, 1), due_date=due,
        status=status, subtotal=Decimal(total), tax=Decimal("0"), total=Decimal(total), currency="USD",
    )


class FakePaymentRepository:
    def __init__(self, row: Invoice, *, timezone: str = "UTC"):
        self.invoice = row
        self.company_id = row.company_id
        self.user_id = uuid.uuid4()
        self.timezone = timezone
        self.payments: list[Payment] = []

    async def company_timezone(self) -> str:
        return self.timezone

    async def lock_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        if invoice_id != self.invoice.id:
            raise NotFoundError()
        return self.invoice

    async def payment_invoice_id(self, payment_id: uuid.UUID) -> uuid.UUID:
        for payment in self.payments:
            if payment.id == payment_id:
                return payment.invoice_id
        raise NotFoundError()

    async def lock_payment(self, payment_id: uuid.UUID, invoice_id: uuid.UUID) -> Payment:
        for payment in self.payments:
            if payment.id == payment_id and payment.invoice_id == invoice_id:
                return payment
        raise NotFoundError()

    async def active_payments(self, invoice_id: uuid.UUID) -> list[Payment]:
        return [row for row in self.payments if row.invoice_id == invoice_id]

    async def add(self, payment: Payment) -> Payment:
        payment.id = uuid.uuid4()
        payment.company_id = self.company_id
        payment.created_by = self.user_id
        payment.updated_by = self.user_id
        payment.is_active = True
        self.payments.append(payment)
        return payment

    async def flush(self) -> None:
        return None


def service(row: Invoice, *, timezone: str = "UTC") -> tuple[PaymentService, FakePaymentRepository]:
    repo = FakePaymentRepository(row, timezone=timezone)
    return PaymentService(repo, clock=lambda: NOW), repo  # type: ignore[arg-type]


async def record(authority: PaymentService, row: Invoice, amount: str = "30") -> Payment:
    return await authority.record_manual_payment(
        invoice_id=row.id, amount=Decimal(amount), currency="USD",
        payment_method=PaymentMethod.BANK_TRANSFER, payment_date=date(2026, 8, 18),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE])
async def test_manual_payment_is_immediately_completed_for_eligible_invoice(status):
    row = invoice(status=status)
    authority, repo = service(row)
    payment = await record(authority, row)
    assert payment.status == PaymentStatus.COMPLETED
    assert payment.source == PaymentSource.MANUAL
    assert payment.confirmed_at == NOW
    assert payment.confirmed_by == repo.user_id
    assert row.status == InvoiceStatus.PARTIALLY_PAID


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [InvoiceStatus.DRAFT, InvoiceStatus.PAID, InvoiceStatus.VOID])
async def test_ineligible_invoice_rejects_payment(status):
    row = invoice(status=status)
    authority, _ = service(row)
    with pytest.raises(ConflictError):
        await record(authority, row)


@pytest.mark.asyncio
async def test_positive_matching_currency_and_remaining_balance_are_authoritative():
    row = invoice()
    authority, _ = service(row)
    with pytest.raises(ValidationError):
        await record(authority, row, "0")
    with pytest.raises(ValidationError):
        await authority.record_manual_payment(
            invoice_id=row.id, amount=Decimal("1"), currency="EUR",
            payment_method=PaymentMethod.CASH, payment_date=date.today(),
        )
    await record(authority, row, "70")
    row.status = InvoiceStatus.PARTIALLY_PAID
    with pytest.raises(ConflictError):
        await record(authority, row, "31")
    exact = await record(authority, row, "30")
    assert exact.amount == Decimal("30.00")
    assert row.status == InvoiceStatus.PAID


@pytest.mark.asyncio
@pytest.mark.parametrize("value", ["NaN", "sNaN", "Infinity", "-Infinity"])
async def test_manual_payment_rejects_non_finite_amount(value):
    row = invoice()
    authority, _ = service(row)
    with pytest.raises(ValidationError, match="finite"):
        await record(authority, row, value)


@pytest.mark.asyncio
@pytest.mark.parametrize("value", ["NaN", "sNaN", "Infinity", "-Infinity"])
async def test_refund_rejects_non_finite_amount(value):
    row = invoice()
    authority, _ = service(row)
    payment = await record(authority, row, "100")
    with pytest.raises(ValidationError, match="finite"):
        await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal(value), reason="x")


@pytest.mark.asyncio
async def test_partial_repeated_and_full_refunds_update_status_and_latest_attribution():
    row = invoice()
    authority, repo = service(row)
    payment = await record(authority, row, "100")
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("10"), reason="Correction one")
    assert payment.status == PaymentStatus.COMPLETED
    assert payment.refunded_amount == Decimal("10.00")
    assert row.status == InvoiceStatus.PARTIALLY_PAID
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("30"), reason="Correction two")
    assert payment.refunded_amount == Decimal("40.00")
    assert payment.refund_reason == "Correction two"
    assert payment.refunded_by == repo.user_id
    assert payment.refunded_at == NOW
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("60"), reason="Full correction")
    assert payment.status == PaymentStatus.REFUNDED
    assert payment.refunded_amount == payment.amount


@pytest.mark.asyncio
async def test_refund_rejects_invalid_amount_reason_and_state():
    row = invoice()
    authority, _ = service(row)
    payment = await record(authority, row, "30")
    with pytest.raises(ValidationError):
        await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("0"), reason="x")
    with pytest.raises(ValidationError):
        await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("1"), reason="  ")
    with pytest.raises(ConflictError):
        await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("31"), reason="too much")
    for status in (PaymentStatus.PENDING, PaymentStatus.FAILED, PaymentStatus.REFUNDED):
        payment.status = status
        with pytest.raises(ConflictError):
            await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("1"), reason="invalid")


@pytest.mark.asyncio
async def test_zero_balance_restores_sent_or_overdue_using_company_timezone():
    sent = invoice(due=date(2026, 8, 19))
    authority, _ = service(sent, timezone="America/Los_Angeles")
    payment = await record(authority, sent, "100")
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("100"), reason="reverse")
    assert sent.status == InvoiceStatus.SENT

    overdue = invoice(due=date(2026, 8, 18))
    authority, _ = service(overdue, timezone="Europe/Paris")
    payment = await record(authority, overdue, "100")
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("100"), reason="reverse")
    assert overdue.status == InvoiceStatus.OVERDUE


@pytest.mark.asyncio
async def test_company_local_midnight_and_due_date_equality_restore_sent():
    # UTC is still Aug 18, but Kiritimati is already Aug 19.
    row = invoice(due=date(2026, 8, 19))
    authority, _ = service(row, timezone="Pacific/Kiritimati")
    payment = await record(authority, row, "100")
    await authority.refund_manual_payment(payment_id=payment.id, amount=Decimal("100"), reason="reverse")
    assert row.status == InvoiceStatus.SENT


@pytest.mark.asyncio
async def test_fully_refunded_invoice_accepts_a_new_payment():
    row = invoice(due=date(2026, 8, 31))
    authority, repo = service(row)
    original = await record(authority, row, "100")
    await authority.refund_manual_payment(payment_id=original.id, amount=Decimal("100"), reason="reverse")
    assert original.status == PaymentStatus.REFUNDED
    assert row.status == InvoiceStatus.SENT
    replacement = await record(authority, row, "100")
    assert replacement.status == PaymentStatus.COMPLETED
    assert authority.amount_paid(repo.payments) == Decimal("100.00")
    assert row.status == InvoiceStatus.PAID


def test_effective_balance_supports_partial_and_full_refunds():
    row = invoice()
    authority, repo = service(row)
    repo.payments = [
        Payment(status=PaymentStatus.COMPLETED, amount=Decimal("40"), refunded_amount=Decimal("10")),
        Payment(status=PaymentStatus.COMPLETED, amount=Decimal("60"), refunded_amount=Decimal("0")),
        Payment(status=PaymentStatus.REFUNDED, amount=Decimal("5"), refunded_amount=Decimal("5")),
        Payment(status=PaymentStatus.FAILED, amount=Decimal("9"), refunded_amount=Decimal("0")),
    ]
    assert authority.amount_paid(repo.payments) == Decimal("90.00")


def test_service_exposes_no_generic_financial_identity_mutation():
    assert not hasattr(PaymentService, "update")
    assert not hasattr(PaymentService, "delete")
    assert not hasattr(PaymentService, "set_status")
