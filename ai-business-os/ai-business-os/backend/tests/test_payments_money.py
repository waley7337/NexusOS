"""Money utility tests — Decimal-only Finance calculations."""
from decimal import Decimal

import pytest

from app.payments.currency import currencies_match, normalize_currency
from app.models.enums import PaymentStatus
from app.payments.money import (
    effective_payment_amount,
    invoice_subtotal,
    invoice_total,
    line_total,
    quantize_money,
    to_minor_units,
)


def test_line_total_rounds_half_up():
    assert line_total(Decimal("1.005"), Decimal("10")) == Decimal("10.05")
    assert line_total(Decimal("2"), Decimal("3.333")) == Decimal("6.67")


def test_invoice_subtotal_and_total():
    subtotal = invoice_subtotal([Decimal("10.00"), Decimal("6.67")])
    assert subtotal == Decimal("16.67")
    assert invoice_total(subtotal, Decimal("1.33")) == Decimal("18.00")


def test_negative_values_rejected():
    with pytest.raises(ValueError):
        line_total(Decimal("-1"), Decimal("10"))
    with pytest.raises(ValueError):
        invoice_total(Decimal("-1"), Decimal("0"))


def test_currency_normalization():
    assert normalize_currency("usd") == "USD"
    with pytest.raises(ValueError):
        normalize_currency("US")
    assert currencies_match("eur", "EUR")


def test_minor_units_usd_and_jpy():
    assert to_minor_units(Decimal("10.50"), "USD") == 1050
    assert to_minor_units(Decimal("1000"), "JPY") == 1000


def test_quantize_money():
    assert quantize_money(Decimal("1.005")) == Decimal("1.01")


@pytest.mark.parametrize("value", ["NaN", "sNaN", "Infinity", "-Infinity"])
def test_non_finite_money_is_rejected(value):
    with pytest.raises(ValueError, match="finite"):
        quantize_money(Decimal(value))


@pytest.mark.parametrize("field", ["amount", "refunded_amount"])
def test_effective_contribution_rejects_corrupt_non_finite_money(field):
    values = {"amount": Decimal("10"), "refunded_amount": Decimal("0")}
    values[field] = Decimal("NaN")
    with pytest.raises(ValueError, match="finite"):
        effective_payment_amount(status=PaymentStatus.COMPLETED, **values)
