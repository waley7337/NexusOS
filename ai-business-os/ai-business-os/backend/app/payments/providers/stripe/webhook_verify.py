"""Stripe webhook signature verification primitive."""
from __future__ import annotations

import hashlib

import stripe

from app.payments.providers.base import ProviderWebhookEvent


class WebhookVerificationError(Exception):
    """Raised when a webhook signature fails verification."""


def verify_stripe_webhook(
    *,
    payload: bytes,
    signature_header: str | None,
    webhook_secret: str | None,
) -> ProviderWebhookEvent:
    if not webhook_secret:
        raise WebhookVerificationError("Webhook secret is not configured")
    if not signature_header:
        raise WebhookVerificationError("Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload.decode("utf-8"),
            signature_header,
            webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise WebhookVerificationError(str(exc)) from exc

    account_ref = event.get("account") if isinstance(event, dict) else getattr(event, "account", None)
    event_id = event["id"] if isinstance(event, dict) else event.id
    event_type = event["type"] if isinstance(event, dict) else event.type

    return ProviderWebhookEvent(
        external_event_id=event_id,
        event_type=event_type,
        provider_account_ref=account_ref,
        payload_hash=hashlib.sha256(payload).hexdigest(),
    )
