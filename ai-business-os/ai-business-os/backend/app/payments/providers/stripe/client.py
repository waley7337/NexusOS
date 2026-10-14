"""Centralized Stripe SDK client — timeouts, API version, no secret logging."""
from __future__ import annotations

from typing import Any

import stripe

from app.core.config import settings
from app.payments.stripe_config import http_timeout_seconds, platform_secret_key


def configure_stripe(*, api_key: str | None = None) -> None:
    key = api_key or platform_secret_key()
    if not key:
        raise RuntimeError("Stripe secret key is not configured")
    stripe.api_key = key
    stripe.max_network_retries = 1
    # Official SDK reads default timeout from stripe.default_http_client when set.
    timeout = http_timeout_seconds()
    if stripe.default_http_client is None:
        stripe.default_http_client = stripe.http_client.RequestsClient(timeout=timeout)
    if settings.STRIPE_API_VERSION:
        stripe.api_version = settings.STRIPE_API_VERSION


def stripe_module(*, api_key: str | None = None) -> Any:
    configure_stripe(api_key=api_key)
    return stripe


def connected_account_options(connected_account_id: str) -> dict[str, str]:
    """Request options for direct charges on a connected account."""
    return {"stripe_account": connected_account_id}
