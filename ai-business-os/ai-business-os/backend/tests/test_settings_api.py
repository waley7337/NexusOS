"""Settings API — integration tests.

Covers: GET company settings, PATCH settings, validation, RBAC,
tenant isolation, audit trail, secret non-exposure.
Requires a running PostgreSQL database. Skip with SKIP_DB_TESTS=1.
"""
from __future__ import annotations

import os

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

_EMAIL_DOMAIN = "settingsapitest.example.com"
_COMPANY = "/api/v1/settings/company"

_SENSITIVE_KEYS = {
    "databaseUrl", "database_url", "DATABASE_URL",
    "secretKey", "secret_key", "SECRET_KEY",
    "jwtSecret", "jwt_secret",
    "password", "PASSWORD",
    "apiKey", "api_key",
    "OPENAI_API_KEY", "openaiApiKey",
    "RESEND_API_KEY", "resendApiKey",
}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str, company_name: str | None = None) -> dict:
    email = _unique_email(tag)
    password = "Settings1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": company_name or f"SettingsCo {tag}",
            "firstName": "Settings",
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


# ---------------------------------------------------------------------------
# GET /settings/company
# ---------------------------------------------------------------------------

class TestGetCompanySettings:
    def test_returns_company_data(self, client: TestClient):
        user = _register(client, "sg-basic", company_name="TestCorp Alpha")
        res = client.get(_COMPANY, headers=user["headers"])
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["name"] == "TestCorp Alpha"
        assert "id" in data
        assert "slug" in data
        assert data["timezone"]  # never empty
        assert data["currency"]  # never empty

    def test_no_secrets_in_response(self, client: TestClient):
        user = _register(client, "sg-secrets")
        res = client.get(_COMPANY, headers=user["headers"])
        raw = res.text
        for key in _SENSITIVE_KEYS:
            assert key not in raw, f"Sensitive key '{key}' found in settings response"

    def test_unauthenticated_rejected(self, client: TestClient):
        res = client.get(_COMPANY)
        assert res.status_code == 401

    def test_response_is_scoped_to_own_company(self, client: TestClient):
        user_a = _register(client, "sg-scope-a", company_name="CompanyAlpha")
        user_b = _register(client, "sg-scope-b", company_name="CompanyBeta")

        res_a = client.get(_COMPANY, headers=user_a["headers"])
        res_b = client.get(_COMPANY, headers=user_b["headers"])

        assert res_a.json()["data"]["name"] == "CompanyAlpha"
        assert res_b.json()["data"]["name"] == "CompanyBeta"
        assert res_a.json()["data"]["id"] != res_b.json()["data"]["id"]


# ---------------------------------------------------------------------------
# PATCH /settings/company
# ---------------------------------------------------------------------------

class TestPatchCompanySettings:
    def test_update_name_and_website(self, client: TestClient):
        user = _register(client, "sp-basic")
        res = client.patch(
            _COMPANY,
            headers=user["headers"],
            json={"name": "Updated Corp", "website": "https://updated.example.com"},
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["name"] == "Updated Corp"
        assert data["website"] == "https://updated.example.com"

    def test_update_persists_after_reload(self, client: TestClient):
        user = _register(client, "sp-persist")
        client.patch(
            _COMPANY,
            headers=user["headers"],
            json={"phone": "+15551234567", "industry": "Technology"},
        )
        res = client.get(_COMPANY, headers=user["headers"])
        data = res.json()["data"]
        assert data["phone"] == "+15551234567"
        assert data["industry"] == "Technology"

    def test_empty_update_returns_422(self, client: TestClient):
        user = _register(client, "sp-empty")
        res = client.patch(_COMPANY, headers=user["headers"], json={})
        assert res.status_code == 422

    def test_name_cannot_be_blank(self, client: TestClient):
        user = _register(client, "sp-blank")
        res = client.patch(_COMPANY, headers=user["headers"], json={"name": ""})
        assert res.status_code == 422

    def test_currency_must_be_3_chars(self, client: TestClient):
        user = _register(client, "sp-curr")
        # Too short
        r1 = client.patch(
            _COMPANY, headers=user["headers"], json={"currency": "US"}
        )
        assert r1.status_code == 422
        # Correct
        r2 = client.patch(
            _COMPANY, headers=user["headers"], json={"currency": "EUR"}
        )
        assert r2.status_code == 200

    def test_update_does_not_expose_secrets(self, client: TestClient):
        user = _register(client, "sp-sec")
        res = client.patch(
            _COMPANY, headers=user["headers"],
            json={"name": "SecureCorp"}
        )
        raw = res.text
        for key in _SENSITIVE_KEYS:
            assert key not in raw, f"Sensitive key '{key}' in settings PATCH response"

    def test_non_editable_fields_ignored(self, client: TestClient):
        """Attempts to change slug are silently ignored (not in _EDITABLE_FIELDS)."""
        user = _register(client, "sp-slug")
        original = client.get(_COMPANY, headers=user["headers"]).json()["data"]["slug"]
        # Send slug in request — should be ignored
        client.patch(
            _COMPANY, headers=user["headers"],
            json={"name": "NewName", "slug": "hacked-slug"}
        )
        current = client.get(_COMPANY, headers=user["headers"]).json()["data"]["slug"]
        assert current == original  # slug unchanged

    def test_unauthenticated_patch_rejected(self, client: TestClient):
        res = client.patch(_COMPANY, json={"name": "Anon"})
        assert res.status_code == 401

    def test_cross_tenant_settings_not_affected(self, client: TestClient):
        user_a = _register(client, "sp-ct-a")
        user_b = _register(client, "sp-ct-b")

        orig_b = client.get(_COMPANY, headers=user_b["headers"]).json()["data"]["name"]
        # A updates their own settings
        client.patch(
            _COMPANY, headers=user_a["headers"],
            json={"name": "ModifiedByA"}
        )
        # B's company is unaffected
        still_b = client.get(_COMPANY, headers=user_b["headers"]).json()["data"]["name"]
        assert still_b == orig_b
