"""Money utility tests — Decimal-only Finance calculations."""
from decimal import Decimal

import pytest

from app.payments.currency import currencies_match, normalize_currency
from app.payments.money import invoice_subtotal, invoice_total, line_total, quantize_money, to_minor_units


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
