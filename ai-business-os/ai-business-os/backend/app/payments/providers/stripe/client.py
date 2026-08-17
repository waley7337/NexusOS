"""Thin Stripe SDK client construction — no live calls in foundation."""
from __future__ import annotations

from typing import Any

import stripe

from app.core.config import settings


def _resolve_secret(value: str | Any | None) -> str | None:
    if value is None:
        return None
    if hasattr(value, "get_secret_value"):
        return value.get_secret_value()
    return str(value)


def configure_stripe_api_key(api_key: str | None = None) -> None:
    key = api_key or _resolve_secret(settings.STRIPE_PLATFORM_SECRET_KEY)
    if key:
        stripe.api_key = key


def stripe_client_for_platform() -> Any:
    configure_stripe_api_key()
    return stripe


def stripe_client_for_connected_account(connected_account_id: str) -> dict[str, str]:
    """Request options for direct charges on a connected account."""
    return {"stripe_account": connected_account_id}
