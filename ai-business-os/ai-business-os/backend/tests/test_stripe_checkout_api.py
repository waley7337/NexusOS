"""HTTP authz / fail-closed coverage for Stripe Checkout + billing routes.

Requires a migrated local test DB (default nexus). Not a production migration.
"""
from __future__ import annotations

import os

# Point the app settings singleton at the local test database before import.
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus",
    ),
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ConflictError, ServiceUnavailableError
from app.main import app
from app.payments.tenant.checkout_service import InvoiceCheckoutSession

_EMAIL_DOMAIN = "stripecheckout.example.com"
_INVOICES = "/api/v1/finance/invoices"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def _register(client: TestClient, tag: str) -> dict:
    email = f"{tag}-{uuid.uuid4().hex}@{_EMAIL_DOMAIN}"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"Stripe {tag}",
            "firstName": "Stripe",
            "lastName": "Tester",
            "email": email,
            "password": "StripeCheckout1234",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    return {
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
        "user": data["user"],
    }


def _sent_invoice(client: TestClient, session: dict) -> dict:
    customer = client.post(
        "/api/v1/crm/customers",
        headers=session["headers"],
        json={"companyName": "Checkout Customer", "status": "active"},
    ).json()["data"]
    today = date.today()
    invoice = client.post(
        _INVOICES,
        headers=session["headers"],
        json={
            "invoiceNumber": f"SC-{uuid.uuid4().hex[:10]}",
            "customerId": customer["id"],
            "issueDate": today.isoformat(),
            "dueDate": (today + timedelta(days=14)).isoformat(),
            "currency": "USD",
            "tax": "0.00",
            "items": [{"description": "Item", "quantity": "1", "unitPrice": "80.00"}],
        },
    ).json()["data"]
    sent = client.post(f"{_INVOICES}/{invoice['id']}/send", headers=session["headers"])
    assert sent.status_code == 200, sent.text
    return sent.json()["data"]


def test_checkout_requires_auth(client):
    response = client.post(
        f"{_INVOICES}/{uuid.uuid4()}/checkout",
        headers={"Idempotency-Key": "anon"},
    )
    assert response.status_code == 401


def test_checkout_fail_closed_when_disabled(client):
    session = _register(client, "disabled")
    invoice = _sent_invoice(client, session)

    async def _disabled(*_a, **_k):
        raise ServiceUnavailableError(
            "Tenant card payments are not enabled.",
            details={"reason": "stripe_tenant_payments_disabled"},
        )

    with patch(
        "app.api.v1.finance.checkout.TenantInvoiceCheckoutService.create_checkout",
        new=AsyncMock(side_effect=_disabled),
    ):
        response = client.post(
            f"{_INVOICES}/{invoice['id']}/checkout",
            headers={**session["headers"], "Idempotency-Key": "k-disabled"},
        )
    assert response.status_code == 503
    assert response.json()["errors"][0]["reason"] == "stripe_tenant_payments_disabled"


def test_checkout_requires_connect_ready(client):
    session = _register(client, "noconnect")
    invoice = _sent_invoice(client, session)

    async def _not_ready(*_a, **_k):
        raise ConflictError(
            "Stripe Connect is not ready to accept invoice payments.",
            details={"reason": "stripe_connect_not_ready"},
        )

    with patch(
        "app.api.v1.finance.checkout.TenantInvoiceCheckoutService.create_checkout",
        new=AsyncMock(side_effect=_not_ready),
    ):
        response = client.post(
            f"{_INVOICES}/{invoice['id']}/checkout",
            headers={**session["headers"], "Idempotency-Key": "k-connect"},
        )
    assert response.status_code == 409
    assert response.json()["errors"][0]["reason"] == "stripe_connect_not_ready"


def test_checkout_success_returns_url(client):
    session = _register(client, "ok")
    invoice = _sent_invoice(client, session)
    fake = InvoiceCheckoutSession(
        payment_id=uuid.uuid4(),
        checkout_session_id="cs_test_1",
        checkout_url="https://checkout.stripe.com/c/pay/cs_test_1",
        amount=Decimal("80.00"),
        currency="USD",
        reused=False,
    )
    with patch(
        "app.api.v1.finance.checkout.TenantInvoiceCheckoutService.create_checkout",
        new=AsyncMock(return_value=fake),
    ):
        response = client.post(
            f"{_INVOICES}/{invoice['id']}/checkout",
            headers={**session["headers"], "Idempotency-Key": "k-ok"},
        )
    assert response.status_code == 201, response.text
    body = response.json()["data"]
    assert body["checkoutUrl"].startswith("https://checkout.stripe.com/")
    assert body["amount"] == "80.00"


def test_billing_status_requires_settings_view(client):
    session = _register(client, "billing")
    response = client.get("/api/v1/billing/subscription", headers=session["headers"])
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["plan"] == "free"
    assert "entitled" in data
    assert "billingEnabled" in data
    # Disabled billing is a successful status payload — never an API error.
    assert data["billingEnabled"] is False


def test_billing_checkout_fail_closed_when_disabled(client):
    session = _register(client, "billoff")
    response = client.post(
        "/api/v1/billing/checkout",
        headers={**session["headers"], "Idempotency-Key": "bill-off"},
        json={"plan": "starter"},
    )
    assert response.status_code == 503
    assert response.json()["errors"][0]["reason"] == "stripe_billing_disabled"


def test_billing_checkout_rejects_free_plan(client):
    session = _register(client, "freeplan")
    response = client.post(
        "/api/v1/billing/checkout",
        headers={**session["headers"], "Idempotency-Key": "bill-free"},
        json={"plan": "free"},
    )
    assert response.status_code == 422


def test_payment_providers_status_owner(client):
    session = _register(client, "providers")
    response = client.get(
        "/api/v1/finance/payment-providers/stripe",
        headers=session["headers"],
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["chargesEnabled"] is False
    assert "paymentsEnabled" in data
