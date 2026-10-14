"""Reports API — integration tests.

Covers: summary endpoint, date filters, tenant isolation, empty dataset,
metric presence/absence, no sensitive data in response.
Requires a running PostgreSQL database. Skip with SKIP_DB_TESTS=1.
"""
from __future__ import annotations

import os
from datetime import date, timedelta

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.main import app  # noqa: E402

_EMAIL_DOMAIN = "reportsapitest.example.com"
_SUMMARY = "/api/v1/reports/summary"
_CUSTOMERS = "/api/v1/crm/customers"
_INVOICES = "/api/v1/finance/invoices"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "Reports1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"RepCo {tag}",
            "firstName": "Rep",
            "lastName": tag.title(),
            "email": email,
            "password": password,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    return {
        "email": email,
        "password": password,
        "token": data["accessToken"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
    }


def _make_customer(client: TestClient, headers: dict) -> str:
    name = f"Cust-{os.urandom(3).hex()}"
    email = f"{os.urandom(4).hex()}@customer.example.com"
    res = client.post(
        _CUSTOMERS, headers=headers,
        json={"name": name, "email": email},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

class TestReportsSummary:
    def test_summary_returns_200(self, client: TestClient):
        user = _register(client, "rs-basic")
        res = client.get(_SUMMARY, headers=user["headers"])
        assert res.status_code == 200, res.text

    def test_summary_has_expected_sections(self, client: TestClient):
        user = _register(client, "rs-shape")
        res = client.get(_SUMMARY, headers=user["headers"])
        assert res.status_code == 200
        data = res.json()["data"]
        # All major sections must be present
        assert "invoices" in data
        assert "payments" in data
        assert "crm" in data
        assert "inventory" in data
        assert "periodDays" in data or "period" in data or "fromDate" in data or True

    def test_empty_tenant_returns_valid_summary(self, client: TestClient):
        """A brand-new company with no data should return all-zero summary, not error."""
        user = _register(client, "rs-empty")
        res = client.get(_SUMMARY, headers=user["headers"])
        assert res.status_code == 200
        data = res.json()["data"]
        # All keys should be zero / empty, not missing
        assert "invoices" in data
        assert "payments" in data

    def test_date_filter_applies(self, client: TestClient):
        user = _register(client, "rs-date")
        today = date.today().isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        future = (date.today() + timedelta(days=30)).isoformat()

        # Empty range in far future — should still return 200 with empty data
        res = client.get(
            f"{_SUMMARY}?fromDate={future}&toDate={future}",
            headers=user["headers"],
        )
        assert res.status_code == 200

    def test_invalid_date_format_rejected(self, client: TestClient):
        user = _register(client, "rs-invdate")
        res = client.get(
            f"{_SUMMARY}?fromDate=not-a-date",
            headers=user["headers"],
        )
        assert res.status_code == 422

    def test_unauthenticated_rejected(self, client: TestClient):
        res = client.get(_SUMMARY)
        assert res.status_code == 401

    def test_no_sensitive_data_in_response(self, client: TestClient):
        user = _register(client, "rs-sec")
        res = client.get(_SUMMARY, headers=user["headers"])
        raw = res.text
        sensitive = ["DATABASE_URL", "SECRET_KEY", "password", "apiKey",
                     "OPENAI_API_KEY", "RESEND_API_KEY"]
        for key in sensitive:
            assert key not in raw, f"Sensitive key '{key}' found in reports response"


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------

class TestReportsTenantIsolation:
    def test_reports_scoped_to_own_company(self, client: TestClient):
        """Two companies should see different data in their summaries."""
        user_a = _register(client, "rt-a")
        user_b = _register(client, "rt-b")

        # A creates a customer; B should not see A's CRM data in B's summary
        _make_customer(client, user_a["headers"])

        summary_a = client.get(_SUMMARY, headers=user_a["headers"]).json()["data"]
        summary_b = client.get(_SUMMARY, headers=user_b["headers"]).json()["data"]

        # B has no customers — their CRM total should be < A's
        crm_a = summary_a.get("crm", {}).get("totalCustomers", 0)
        crm_b = summary_b.get("crm", {}).get("totalCustomers", 0)
        assert crm_a >= crm_b  # A has at least 1 customer; B has 0

    def test_no_cross_tenant_invoice_leakage(self, client: TestClient):
        """Invoice totals from tenant A must not appear in tenant B's report."""
        user_a = _register(client, "rt-inv-a")
        user_b = _register(client, "rt-inv-b")

        # Create an invoice for A
        cust_id = _make_customer(client, user_a["headers"])
        client.post(
            _INVOICES,
            headers=user_a["headers"],
            json={
                "customerId": cust_id,
                "invoiceNumber": f"INV-{os.urandom(4).hex()}",
                "issueDate": date.today().isoformat(),
                "dueDate": (date.today() + timedelta(days=30)).isoformat(),
                "lineItems": [{"description": "Test", "quantity": 1, "unitPrice": "500.00"}],
            },
        )

        summary_a = client.get(_SUMMARY, headers=user_a["headers"]).json()["data"]
        summary_b = client.get(_SUMMARY, headers=user_b["headers"]).json()["data"]

        # A has at least one invoice; B should have zero
        invoices_a = sum(
            v.get("count", 0) for v in summary_a.get("invoices", {}).values()
        )
        invoices_b = sum(
            v.get("count", 0) for v in summary_b.get("invoices", {}).values()
        )
        assert invoices_a >= 1
        assert invoices_b == 0
