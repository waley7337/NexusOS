"""Stripe webhook signature + dedupe API tests (mocked verification/handlers)."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import WebhookProcessingStatus
from app.payments.providers.base import ProviderWebhookEvent
from app.payments.providers.stripe.webhook_verify import (
    VerifiedStripeWebhook,
    WebhookVerificationError,
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_platform_webhook_rejects_invalid_signature(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.webhooks.stripe.require_platform_webhook_secret",
        lambda: "whsec_test",
    )
    with patch(
        "app.api.v1.webhooks.stripe.verify_stripe_webhook_event",
        side_effect=WebhookVerificationError("bad"),
    ):
        response = client.post(
            "/api/v1/webhooks/stripe/platform",
            content=b'{"id":"evt_1"}',
            headers={"Stripe-Signature": "t=1,v1=x", "Content-Type": "application/json"},
        )
    assert response.status_code == 400


def test_platform_webhook_unavailable_without_secret(client, monkeypatch):
    from app.core.exceptions import ServiceUnavailableError

    def _missing():
        raise ServiceUnavailableError(
            "Platform webhook secret is not configured.",
            details={"reason": "stripe_webhook_secret_missing"},
        )

    monkeypatch.setattr(
        "app.api.v1.webhooks.stripe.require_platform_webhook_secret",
        _missing,
    )
    response = client.post(
        "/api/v1/webhooks/stripe/platform",
        content=b"{}",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 503


def test_platform_webhook_accepts_verified_event(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.webhooks.stripe.require_platform_webhook_secret",
        lambda: "whsec_test",
    )
    envelope = ProviderWebhookEvent(
        external_event_id="evt_dup",
        event_type="customer.subscription.updated",
        provider_account_ref=None,
        payload_hash="abc",
    )
    verified = VerifiedStripeWebhook(
        envelope=envelope,
        event={"id": "evt_dup", "type": "customer.subscription.updated", "data": {"object": {}}},
    )
    with (
        patch(
            "app.api.v1.webhooks.stripe.verify_stripe_webhook_event",
            return_value=verified,
        ),
        patch(
            "app.api.v1.webhooks.stripe.process_platform_stripe_event",
            new=AsyncMock(return_value=SimpleWebhook(WebhookProcessingStatus.PROCESSED)),
        ),
    ):
        response = client.post(
            "/api/v1/webhooks/stripe/platform",
            content=b'{"id":"evt_dup"}',
            headers={"Stripe-Signature": "t=1,v1=good", "Content-Type": "application/json"},
        )
    assert response.status_code == 200


def test_connect_webhook_accepts_verified_event(client, monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.webhooks.stripe.require_connect_webhook_secret",
        lambda: "whsec_connect",
    )
    envelope = ProviderWebhookEvent(
        external_event_id="evt_tenant",
        event_type="checkout.session.completed",
        provider_account_ref="acct_1",
        payload_hash="def",
    )
    verified = VerifiedStripeWebhook(
        envelope=envelope,
        event={"id": "evt_tenant", "type": "checkout.session.completed", "data": {"object": {}}},
    )
    with (
        patch(
            "app.api.v1.webhooks.stripe.verify_stripe_webhook_event",
            return_value=verified,
        ),
        patch(
            "app.api.v1.webhooks.stripe.process_tenant_stripe_event",
            new=AsyncMock(return_value=SimpleWebhook(WebhookProcessingStatus.PROCESSED)),
        ),
    ):
        response = client.post(
            "/api/v1/webhooks/stripe/connect",
            content=b'{"id":"evt_tenant"}',
            headers={"Stripe-Signature": "t=1,v1=good", "Content-Type": "application/json"},
        )
    assert response.status_code == 200


class SimpleWebhook:
    def __init__(self, status: WebhookProcessingStatus):
        self.processing_status = status
        self.id = uuid.uuid4()
