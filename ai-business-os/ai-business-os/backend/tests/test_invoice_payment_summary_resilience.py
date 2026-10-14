"""Invoice list must not 500 when a payment row fails money validation."""

from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace

from app.models.enums import PaymentStatus
from app.repositories.finance import InvoiceRepository


def test_payment_summary_skips_invalid_payment_rows():
    good = SimpleNamespace(
        deleted_at=None,
        is_active=True,
        status=PaymentStatus.COMPLETED,
        amount=Decimal("40.00"),
        refunded_amount=Decimal("0.00"),
    )
    bad_zero = SimpleNamespace(
        deleted_at=None,
        is_active=True,
        status=PaymentStatus.COMPLETED,
        amount=Decimal("0.00"),
        refunded_amount=Decimal("0.00"),
    )
    invoice = SimpleNamespace(
        id=uuid.uuid4(),
        total=Decimal("100.00"),
        payments=[good, bad_zero],
    )
    paid, outstanding = InvoiceRepository.payment_summary(invoice)
    assert paid == Decimal("40.00")
    assert outstanding == Decimal("60.00")
