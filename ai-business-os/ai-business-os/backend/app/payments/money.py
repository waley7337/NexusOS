"""Shared money utilities — Decimal-only arithmetic for Finance."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

MONEY_PRECISION = Decimal("0.01")
QUANTITY_PRECISION = Decimal("0.01")


def quantize_money(value: Decimal) -> Decimal:
    """Round to 2 decimal places using ROUND_HALF_UP."""
    return value.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


def quantize_quantity(value: Decimal) -> Decimal:
    return value.quantize(QUANTITY_PRECISION, rounding=ROUND_HALF_UP)


def line_total(quantity: Decimal, unit_price: Decimal) -> Decimal:
    """Compute authoritative line total: round(qty × price, 2)."""
    if quantity < 0:
        raise ValueError("quantity must be >= 0")
    if unit_price < 0:
        raise ValueError("unit_price must be >= 0")
    return quantize_money(quantity * unit_price)


def invoice_subtotal(line_totals: list[Decimal]) -> Decimal:
    if any(total < 0 for total in line_totals):
        raise ValueError("line totals must be >= 0")
    return quantize_money(sum(line_totals, start=Decimal("0")))


def invoice_total(subtotal: Decimal, tax: Decimal) -> Decimal:
    if subtotal < 0:
        raise ValueError("subtotal must be >= 0")
    if tax < 0:
        raise ValueError("tax must be >= 0")
    return quantize_money(subtotal + tax)


def to_minor_units(amount: Decimal, currency: str) -> int:
    """Convert decimal amount to provider minor units.

    Zero-decimal currencies (e.g. JPY) must be handled explicitly — do not
    blindly multiply every currency by 100.
    """
    code = currency.strip().upper()
    zero_decimal = {"BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"}
    if code in zero_decimal:
        return int(quantize_money(amount))
    return int(quantize_money(amount) * 100)
