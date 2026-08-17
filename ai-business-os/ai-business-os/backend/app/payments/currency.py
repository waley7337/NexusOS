"""ISO-4217 currency validation for Finance records."""
from __future__ import annotations

import re

_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")


def normalize_currency(value: str) -> str:
    """Validate and uppercase a 3-letter ISO currency code."""
    code = value.strip().upper()
    if not _CURRENCY_RE.match(code):
        raise ValueError(f"Invalid currency code: {value!r}")
    return code


def currencies_match(left: str, right: str) -> bool:
    return normalize_currency(left) == normalize_currency(right)
