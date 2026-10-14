"""Dashboard metrics API — integration tests.

Covers:
  * GET /api/v1/dashboard/metrics returns 200 with required keys
  * All values are zero for a brand-new tenant (empty dataset)
  * Finance metrics count open/overdue invoices correctly
  * CRM customer count increments correctly
  * Projects / Tasks counts are accurate and tenant-scoped
  * Tenant isolation — tenant B cannot see tenant A's data
  * Unauthenticated request returns 401

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

_EMAIL_DOMAIN = "dashboardapitest.example.com"
_METRICS_URL = "/api/v1/dashboard/metrics"
_CUSTOMERS_URL = "/api/v1/crm/customers"
_INVOICES_URL = "/api/v1/finance/invoices"
_PROJECTS_URL = "/api/v1/projects"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "Dashboard1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"DashCo {tag}",
            "firstName": "Dash",
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
    email = f"{os.urandom(4).hex()}@cust.example.com"
    res = client.post(
        _CUSTOMERS_URL, headers=headers,
        json={"companyName": name, "email": email, "status": "active"},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


def _make_invoice(client: TestClient, headers: dict, customer_id: str) -> str:
    res = client.post(
        _INVOICES_URL,
        headers=headers,
        json={
            "invoiceNumber": f"INV-{os.urandom(3).hex()}",
            "customerId": customer_id,
            "issueDate": date.today().isoformat(),
            "dueDate": (date.today() + timedelta(days=30)).isoformat(),
            "currency": "USD",
            "tax": "0.00",
            "items": [
                {"description": "Service", "quantity": "1", "unitPrice": "100.00"},
            ],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


def _send_invoice(client: TestClient, headers: dict, invoice_id: str) -> None:
    res = client.post(f"{_INVOICES_URL}/{invoice_id}/send", headers=headers)
    assert res.status_code == 200, res.text


def _make_project(client: TestClient, headers: dict, status: str = "active") -> str:
    res = client.post(
        _PROJECTS_URL,
        headers=headers,
        json={
            "name": f"Proj-{os.urandom(3).hex()}",
            "status": status,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Shape / schema tests
# ---------------------------------------------------------------------------


def test_metrics_unauthenticated_returns_401(client: TestClient):
    """No auth token → 401."""
    res = client.get(_METRICS_URL)
    assert res.status_code == 401


def test_metrics_returns_200_and_required_keys(client: TestClient):
    """Fresh tenant — 200 with all expected top-level section keys."""
    auth = _register(client, "schema")
    res = client.get(_METRICS_URL, headers=auth["headers"])
    assert res.status_code == 200, res.text

    body = res.json()
    assert body["success"] is True
    data = body["data"]

    assert "asOf" in data
    assert "monthStart" in data
    assert "finance" in data
    assert "crm" in data
    assert "projects" in data
    assert "hr" in data
    assert "inventory" in data


def test_metrics_finance_keys_present(client: TestClient):
    auth = _register(client, "finkeys")
    res = client.get(_METRICS_URL, headers=auth["headers"])
    finance = res.json()["data"]["finance"]
    for key in ("openInvoiceCount", "overdueInvoiceCount", "outstandingAmount",
                "collectedThisMonth", "collectedPaymentCount"):
        assert key in finance, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# Empty dataset — all-zero values
# ---------------------------------------------------------------------------


def test_metrics_empty_tenant_returns_zeros(client: TestClient):
    """Brand new tenant with no data should return zero counts, not errors."""
    auth = _register(client, "empty")
    res = client.get(_METRICS_URL, headers=auth["headers"])
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["crm"]["customerCount"] == 0
    assert data["crm"]["openLeadCount"] == 0
    assert data["crm"]["openDealCount"] == 0
    assert data["finance"]["openInvoiceCount"] == 0
    assert data["finance"]["overdueInvoiceCount"] == 0
    assert data["projects"]["activeProjectCount"] == 0
    assert data["projects"]["overdueTaskCount"] == 0
    assert data["hr"]["employeeCount"] == 0
    assert data["inventory"]["lowStockCount"] == 0


# ---------------------------------------------------------------------------
# CRM metrics accuracy
# ---------------------------------------------------------------------------


def test_crm_customer_count_increments(client: TestClient):
    auth = _register(client, "crmcount")
    res0 = client.get(_METRICS_URL, headers=auth["headers"])
    initial = res0.json()["data"]["crm"]["customerCount"]

    _make_customer(client, auth["headers"])
    _make_customer(client, auth["headers"])

    res1 = client.get(_METRICS_URL, headers=auth["headers"])
    updated = res1.json()["data"]["crm"]["customerCount"]
    assert updated == initial + 2


# ---------------------------------------------------------------------------
# Finance metrics accuracy
# ---------------------------------------------------------------------------


def test_open_invoice_count_reflects_status(client: TestClient):
    """Invoices in draft status should NOT count as open."""
    auth = _register(client, "finstatus")
    cid = _make_customer(client, auth["headers"])

    # Two draft invoices — should not count as open
    _make_invoice(client, auth["headers"], cid)
    _make_invoice(client, auth["headers"], cid)

    res = client.get(_METRICS_URL, headers=auth["headers"])
    data = res.json()["data"]["finance"]

    # Draft invoices don't count as open
    assert data["openInvoiceCount"] == 0


def test_sent_invoice_counts_as_open(client: TestClient):
    """An invoice in 'sent' status should increment openInvoiceCount."""
    auth = _register(client, "finsent")
    cid = _make_customer(client, auth["headers"])

    # Create a draft then send
    inv_id = _make_invoice(client, auth["headers"], cid)
    _send_invoice(client, auth["headers"], inv_id)

    res = client.get(_METRICS_URL, headers=auth["headers"])
    data = res.json()["data"]["finance"]
    assert data["openInvoiceCount"] >= 1


# ---------------------------------------------------------------------------
# Projects metrics accuracy
# ---------------------------------------------------------------------------


def test_active_project_count(client: TestClient):
    auth = _register(client, "projcount")

    res0 = client.get(_METRICS_URL, headers=auth["headers"])
    initial = res0.json()["data"]["projects"]["activeProjectCount"]

    _make_project(client, auth["headers"], status="active")
    _make_project(client, auth["headers"], status="active")
    _make_project(client, auth["headers"], status="planned")  # should not count

    res1 = client.get(_METRICS_URL, headers=auth["headers"])
    updated = res1.json()["data"]["projects"]["activeProjectCount"]
    assert updated == initial + 2


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------


def test_tenant_isolation_crm(client: TestClient):
    """Tenant A's customers are invisible to Tenant B."""
    auth_a = _register(client, "iso-a")
    auth_b = _register(client, "iso-b")

    # Tenant A creates 3 customers
    for _ in range(3):
        _make_customer(client, auth_a["headers"])

    res_b = client.get(_METRICS_URL, headers=auth_b["headers"])
    assert res_b.json()["data"]["crm"]["customerCount"] == 0


def test_tenant_isolation_finance(client: TestClient):
    """Tenant A's invoices are invisible to Tenant B."""
    auth_a = _register(client, "iso-fin-a")
    auth_b = _register(client, "iso-fin-b")

    cid = _make_customer(client, auth_a["headers"])
    inv_id = _make_invoice(client, auth_a["headers"], cid)
    _send_invoice(client, auth_a["headers"], inv_id)

    res_b = client.get(_METRICS_URL, headers=auth_b["headers"])
    assert res_b.json()["data"]["finance"]["openInvoiceCount"] == 0


def test_tenant_isolation_projects(client: TestClient):
    """Tenant A's projects are invisible to Tenant B."""
    auth_a = _register(client, "iso-proj-a")
    auth_b = _register(client, "iso-proj-b")

    _make_project(client, auth_a["headers"], status="active")
    _make_project(client, auth_a["headers"], status="active")

    res_b = client.get(_METRICS_URL, headers=auth_b["headers"])
    assert res_b.json()["data"]["projects"]["activeProjectCount"] == 0


# ---------------------------------------------------------------------------
# Date boundary: asOf / monthStart
# ---------------------------------------------------------------------------


def test_date_fields_are_valid_iso_dates(client: TestClient):
    auth = _register(client, "dates")
    res = client.get(_METRICS_URL, headers=auth["headers"])
    data = res.json()["data"]

    today = date.today()
    as_of = date.fromisoformat(data["asOf"])
    month_start = date.fromisoformat(data["monthStart"])

    assert as_of == today
    assert month_start == today.replace(day=1)
    assert month_start <= as_of
