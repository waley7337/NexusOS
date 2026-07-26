"""Tests for the temporary token-gated proxy-diagnostics endpoint.

Confirms the endpoint stays dark by default, never leaks secrets/headers,
returns only the approved diagnostic fields when correctly authorized, and
compares tokens via `secrets.compare_digest` (not plain `==`).
"""
import inspect
import json
import os
import secrets

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from app.core import config as config_module  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

PATH = "/api/v1/internal/proxy-diagnostics"
TOKEN_HEADER = "X-Nexus-Diagnostic-Token"
VALID_TOKEN = "proxy-diag-test-token-not-for-production"

APPROVED_DATA_FIELDS = {
    "peerIp",
    "xRealIp",
    "xForwardedFor",
    "xForwardedProto",
    "xForwardedHost",
    "resolvedIp",
    "resolvedScheme",
    "viaTrustedProxy",
}


def _client(peer_host: str = "203.0.113.50") -> TestClient:
    return TestClient(app, client=(peer_host, 12345))


def _assert_generic_404_no_store(res) -> None:
    assert res.status_code == 404
    assert res.headers.get("cache-control") == "no-store"
    body = res.json()
    assert body == {"detail": "Not Found"}
    dumped = json.dumps(body).lower()
    assert "disabled" not in dumped
    assert "token" not in dumped
    assert "configured" not in dumped
    assert "missing" not in dumped
    assert "wrong" not in dumped


@pytest.fixture
def enable_diagnostics(monkeypatch):
    monkeypatch.setattr(settings, "PROXY_DIAGNOSTICS_ENABLED", True)
    monkeypatch.setattr(
        settings, "PROXY_DIAGNOSTICS_TOKEN", SecretStr(VALID_TOKEN)
    )


def test_route_absent_from_openapi_schema():
    with _client() as c:
        res = c.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema.get("paths", {})
    assert PATH not in paths
    assert "/api/v1/internal/proxy-diagnostics" not in paths
    # No residual mention under any method for this temporary route.
    for path_key in paths:
        assert "proxy-diagnostics" not in path_key


def test_disabled_endpoint_returns_404_with_no_store():
    assert settings.PROXY_DIAGNOSTICS_ENABLED is False
    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: VALID_TOKEN})
    _assert_generic_404_no_store(res)


def test_enabled_with_no_configured_token_returns_404_with_no_store(monkeypatch):
    monkeypatch.setattr(settings, "PROXY_DIAGNOSTICS_ENABLED", True)
    monkeypatch.setattr(settings, "PROXY_DIAGNOSTICS_TOKEN", None)
    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: VALID_TOKEN})
    _assert_generic_404_no_store(res)


def test_enabled_with_empty_configured_token_returns_404_with_no_store(monkeypatch):
    monkeypatch.setattr(settings, "PROXY_DIAGNOSTICS_ENABLED", True)
    monkeypatch.setattr(settings, "PROXY_DIAGNOSTICS_TOKEN", SecretStr(""))
    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: VALID_TOKEN})
    _assert_generic_404_no_store(res)


def test_missing_request_token_returns_404_with_no_store(enable_diagnostics):
    with _client() as c:
        res = c.get(PATH)
    _assert_generic_404_no_store(res)


def test_wrong_request_token_returns_404_with_no_store(enable_diagnostics):
    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: "wrong-token"})
    _assert_generic_404_no_store(res)


def test_correct_token_returns_200_with_exact_data_keys(enable_diagnostics):
    peer = "203.0.113.77"
    with _client(peer) as c:
        res = c.get(
            PATH,
            headers={
                TOKEN_HEADER: VALID_TOKEN,
                "X-Forwarded-For": "198.51.100.9",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "api.example.com",
                "X-Real-IP": "198.51.100.9",
                "Authorization": "Bearer should-never-appear",
                "Cookie": "session=should-never-appear",
            },
        )

    assert res.status_code == 200
    assert res.headers.get("cache-control") == "no-store"

    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert set(data.keys()) == APPROVED_DATA_FIELDS
    assert data["peerIp"] == peer
    assert data["xRealIp"] == "198.51.100.9"
    assert data["xForwardedFor"] == "198.51.100.9"
    assert data["xForwardedProto"] == "https"
    assert data["xForwardedHost"] == "api.example.com"

    raw = res.text
    assert VALID_TOKEN not in raw
    assert "should-never-appear" not in raw
    assert "Bearer" not in raw
    assert "session=" not in raw
    assert "Authorization" not in raw
    assert "Cookie" not in raw
    assert "SECRET_KEY" not in raw
    assert "DATABASE_URL" not in raw
    assert "REDIS_URL" not in raw
    assert set(body.keys()) <= {"success", "data", "message", "errors"}


def test_normal_header_values_returned_unchanged(enable_diagnostics):
    with _client() as c:
        res = c.get(
            PATH,
            headers={
                TOKEN_HEADER: VALID_TOKEN,
                "X-Real-IP": "203.0.113.10",
                "X-Forwarded-For": "203.0.113.10, 10.0.0.1",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "api.example.test:443",
            },
        )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["xRealIp"] == "203.0.113.10"
    assert data["xForwardedFor"] == "203.0.113.10, 10.0.0.1"
    assert data["xForwardedProto"] == "https"
    assert data["xForwardedHost"] == "api.example.test:443"


def test_header_values_longer_than_4096_are_bounded(enable_diagnostics):
    oversized = "A" * 5000
    with _client() as c:
        res = c.get(
            PATH,
            headers={
                TOKEN_HEADER: VALID_TOKEN,
                "X-Forwarded-For": oversized,
                "X-Real-IP": oversized,
                "X-Forwarded-Host": oversized,
                "X-Forwarded-Proto": oversized,
            },
        )
    assert res.status_code == 200
    data = res.json()["data"]
    for key in ("xForwardedFor", "xRealIp", "xForwardedHost", "xForwardedProto"):
        assert data[key] is not None
        assert len(data[key]) == 4096
        assert data[key] == "A" * 4096


def test_cr_lf_null_stripped_from_reflected_headers(enable_diagnostics):
    dirty = "203.0.113.1\r\ninjected\x00trail"
    with _client() as c:
        res = c.get(
            PATH,
            headers={
                TOKEN_HEADER: VALID_TOKEN,
                "X-Forwarded-For": dirty,
                "X-Real-IP": dirty,
                "X-Forwarded-Host": dirty,
                "X-Forwarded-Proto": "ht\rtp\ns\x00",
            },
        )
    assert res.status_code == 200
    data = res.json()["data"]
    for key in ("xForwardedFor", "xRealIp", "xForwardedHost", "xForwardedProto"):
        value = data[key]
        assert value is not None
        assert "\r" not in value
        assert "\n" not in value
        assert "\x00" not in value
    assert data["xForwardedFor"] == "203.0.113.1injectedtrail"
    assert data["xForwardedProto"] == "https"


def test_mode_none_ignores_client_supplied_forwarded_for(enable_diagnostics):
    assert settings.TRUSTED_PROXY_MODE == "none"
    peer = "203.0.113.88"
    spoofed = "198.51.100.44"
    with _client(peer) as c:
        res = c.get(
            PATH,
            headers={
                TOKEN_HEADER: VALID_TOKEN,
                "X-Forwarded-For": spoofed,
                "X-Forwarded-Proto": "https",
            },
        )

    assert res.status_code == 200
    data = res.json()["data"]
    assert set(data.keys()) == APPROVED_DATA_FIELDS
    assert data["viaTrustedProxy"] is False
    assert data["peerIp"] == peer
    assert data["resolvedIp"] == peer
    assert data["resolvedIp"] != spoofed
    assert data["xForwardedFor"] == spoofed


def test_diagnostic_token_never_appears_in_response(enable_diagnostics):
    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: VALID_TOKEN})
    assert res.status_code == 200
    assert VALID_TOKEN not in res.text
    assert VALID_TOKEN not in json.dumps(res.json())
    assert VALID_TOKEN not in json.dumps(dict(res.headers))


def test_token_compared_via_compare_digest_not_equality(
    enable_diagnostics, monkeypatch
):
    calls: list[tuple[str, str]] = []
    real_compare = secrets.compare_digest

    def tracking_compare(a: str | bytes, b: str | bytes) -> bool:
        calls.append(
            (
                a if isinstance(a, str) else a.decode(),
                b if isinstance(b, str) else b.decode(),
            )
        )
        return real_compare(a, b)

    monkeypatch.setattr(
        "app.api.v1.internal.secrets.compare_digest", tracking_compare
    )

    from app.api.v1 import internal as internal_mod

    source = inspect.getsource(internal_mod._proxy_diagnostics_authorized)
    assert "compare_digest" in source
    assert "provided == expected" not in source
    assert "expected == provided" not in source

    with _client() as c:
        res = c.get(PATH, headers={TOKEN_HEADER: VALID_TOKEN})

    assert res.status_code == 200
    assert calls, "secrets.compare_digest must be invoked for token checks"
    assert any(VALID_TOKEN in pair for pair in calls)


def test_defaults_remain_disabled_on_settings_singleton():
    """Guardrail: module defaults must keep the endpoint dark."""
    assert (
        config_module.Settings.model_fields["PROXY_DIAGNOSTICS_ENABLED"].default
        is False
    )
    assert (
        config_module.Settings.model_fields["PROXY_DIAGNOSTICS_TOKEN"].default
        is None
    )
    assert settings.PROXY_DIAGNOSTICS_ENABLED is False
    assert settings.PROXY_DIAGNOSTICS_TOKEN is None
