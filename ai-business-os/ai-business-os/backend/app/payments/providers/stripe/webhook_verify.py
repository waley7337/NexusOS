"""Stripe webhook signature verification primitive."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

import stripe

from app.payments.providers.base import ProviderWebhookEvent


class WebhookVerificationError(Exception):
    """Raised when a webhook signature fails verification."""


@dataclass(frozen=True, slots=True)
class VerifiedStripeWebhook:
    envelope: ProviderWebhookEvent
    event: dict[str, Any]


def verify_stripe_webhook(
    *,
    payload: bytes,
    signature_header: str | None,
    webhook_secret: str | None,
) -> ProviderWebhookEvent:
    """Backward-compatible envelope-only verification."""
    return verify_stripe_webhook_event(
        payload=payload,
        signature_header=signature_header,
        webhook_secret=webhook_secret,
    ).envelope


def verify_stripe_webhook_event(
    *,
    payload: bytes,
    signature_header: str | None,
    webhook_secret: str | None,
) -> VerifiedStripeWebhook:
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

    event_dict = _coerce_event_dict(event)
    account_ref = event_dict.get("account")
    return VerifiedStripeWebhook(
        envelope=ProviderWebhookEvent(
            external_event_id=str(event_dict["id"]),
            event_type=str(event_dict["type"]),
            provider_account_ref=str(account_ref) if account_ref else None,
            payload_hash=hashlib.sha256(payload).hexdigest(),
        ),
        event=event_dict,
    )


def _coerce_event_dict(event: Any) -> dict[str, Any]:
    if isinstance(event, dict):
        return event
    # Prefer attribute access used by stripe.Event / unit-test mocks.
    event_id = getattr(event, "id", None)
    event_type = getattr(event, "type", None)
    if event_id is not None and event_type is not None:
        account = getattr(event, "account", None)
        data = getattr(event, "data", None)
        payload: dict[str, Any] = {"id": event_id, "type": event_type}
        if account is not None:
            payload["account"] = account
        if data is not None:
            payload["data"] = data.to_dict() if hasattr(data, "to_dict") else data
        return payload
    if callable(getattr(event, "to_dict", None)):
        converted = event.to_dict()
        if isinstance(converted, dict) and "id" in converted and "type" in converted:
            return converted
    return dict(event)
