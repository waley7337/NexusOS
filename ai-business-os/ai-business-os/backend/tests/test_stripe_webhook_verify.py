"""Stripe webhook verification foundation tests."""
from __future__ import annotations

import hashlib
from unittest.mock import MagicMock, patch

import pytest

from app.payments.providers.stripe.webhook_verify import WebhookVerificationError, verify_stripe_webhook


def test_verify_stripe_webhook_accepts_valid_signature():
    payload = b'{"id":"evt_123","type":"payment_intent.succeeded","account":"acct_123"}'
    mock_event = MagicMock()
    mock_event.__getitem__ = lambda self, key: {"id": "evt_123", "type": "payment_intent.succeeded"}[key]
    mock_event.id = "evt_123"
    mock_event.type = "payment_intent.succeeded"
    mock_event.account = "acct_123"
    mock_event.get = lambda key, default=None: {"account": "acct_123"}.get(key, default)

    with patch("app.payments.providers.stripe.webhook_verify.stripe.Webhook.construct_event", return_value=mock_event):
        event = verify_stripe_webhook(
            payload=payload,
            signature_header="t=1,v1=valid",
            webhook_secret="whsec_test_secret",
        )
    assert event.external_event_id == "evt_123"
    assert event.event_type == "payment_intent.succeeded"
    assert event.provider_account_ref == "acct_123"
    assert event.payload_hash == hashlib.sha256(payload).hexdigest()


def test_verify_stripe_webhook_rejects_invalid_signature():
    payload = b'{"id":"evt_bad","type":"x"}'
    import stripe

    with patch(
        "app.payments.providers.stripe.webhook_verify.stripe.Webhook.construct_event",
        side_effect=stripe.SignatureVerificationError("bad sig", "sig"),
    ):
        with pytest.raises(WebhookVerificationError):
            verify_stripe_webhook(
                payload=payload,
                signature_header="t=1,v1=deadbeef",
                webhook_secret="whsec_test_secret",
            )


def test_verify_stripe_webhook_requires_secret():
    with pytest.raises(WebhookVerificationError):
        verify_stripe_webhook(payload=b"{}", signature_header="t=1,v1=x", webhook_secret=None)
