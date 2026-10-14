"""Shared money utilities — Decimal-only arithmetic for Finance."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from app.models.enums import PaymentStatus

MONEY_PRECISION = Decimal("0.01")
QUANTITY_PRECISION = Decimal("0.01")


def quantize_money(value: Decimal) -> Decimal:
    """Round to 2 decimal places using ROUND_HALF_UP."""
    if not value.is_finite():
        raise ValueError("money value must be finite")
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


def effective_payment_amount(
    *, status: PaymentStatus, amount: Decimal, refunded_amount: Decimal
) -> Decimal:
    """Authoritative contribution of one payment to an invoice balance."""
    amount = quantize_money(amount)
    refunded_amount = quantize_money(refunded_amount)
    if amount <= 0 or refunded_amount < 0 or refunded_amount > amount:
        raise ValueError("invalid payment amount or refunded amount")
    if status == PaymentStatus.REFUNDED:
        if refunded_amount != amount:
            raise ValueError("refunded payments must be fully refunded")
        return Decimal("0.00")
    if status == PaymentStatus.COMPLETED:
        return quantize_money(amount - refunded_amount)
    return Decimal("0.00")


_ZERO_DECIMAL = frozenset(
    {
        "BIF",
        "CLP",
        "DJF",
        "GNF",
        "JPY",
        "KMF",
        "KRW",
        "MGA",
        "PYG",
        "RWF",
        "UGX",
        "VND",
        "VUV",
        "XAF",
        "XOF",
        "XPF",
    }
)


def to_minor_units(amount: Decimal, currency: str) -> int:
    """Convert decimal amount to provider minor units.

    Zero-decimal currencies (e.g. JPY) must be handled explicitly — do not
    blindly multiply every currency by 100.
    """
    code = currency.strip().upper()
    if code in _ZERO_DECIMAL:
        return int(quantize_money(amount))
    return int(quantize_money(amount) * 100)


def from_minor_units(amount_minor: int, currency: str) -> Decimal:
    """Convert provider minor units back to a quantized Decimal amount."""
    if amount_minor < 0:
        raise ValueError("minor units must be >= 0")
    code = currency.strip().upper()
    if code in _ZERO_DECIMAL:
        return quantize_money(Decimal(amount_minor))
    return quantize_money(Decimal(amount_minor) / Decimal(100))
