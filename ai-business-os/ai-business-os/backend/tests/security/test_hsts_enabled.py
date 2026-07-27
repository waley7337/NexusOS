"""Explicit HSTS enablement — TLS-terminated edges without trusted proxies.

Railway (and similar) terminate TLS and forward plain HTTP with
`X-Forwarded-Proto=https`. With `TRUSTED_PROXY_MODE=none` the resolver
correctly ignores that header and reports `scheme=http`, so HSTS would
otherwise never be emitted. `settings.HSTS_ENABLED` is the operator
escape hatch that does not require trusting forwarded headers or CIDRs.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.core import config as config_module  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

HEALTH_PATH = "/api/v1/health"
HSTS_VALUE = "max-age=63072000; includeSubDomains"
BASELINE = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cache-control": "no-store",
}


def _client(peer_host: str = "203.0.113.50") -> TestClient:
    return TestClient(app, client=(peer_host, 12345))


def _assert_baseline(res) -> None:
    for header, value in BASELINE.items():
        assert res.headers.get(header) == value


@pytest.fixture(autouse=True)
def _isolate_hsts_and_proxy_settings(monkeypatch):
    """Every test starts from safe defaults; monkeypatch reverts after."""
    monkeypatch.setattr(settings, "HSTS_ENABLED", False)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "none")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", [])


def test_hsts_enabled_true_with_resolved_http_emits_hsts(monkeypatch):
    monkeypatch.setattr(settings, "HSTS_ENABLED", True)
    with _client() as c:
        res = c.get(HEALTH_PATH)
    assert res.headers.get("strict-transport-security") == HSTS_VALUE
    _assert_baseline(res)


def test_hsts_enabled_false_with_resolved_http_omits_hsts():
    assert settings.HSTS_ENABLED is False
    with _client() as c:
        res = c.get(HEALTH_PATH)
    assert res.headers.get("strict-transport-security") is None
    _assert_baseline(res)


def test_hsts_enabled_false_with_trusted_resolved_https_emits_hsts(monkeypatch):
    monkeypatch.setattr(settings, "HSTS_ENABLED", False)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "static")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", ["10.0.0.0/8"])
    with _client("10.1.2.3") as c:
        res = c.get(HEALTH_PATH, headers={"X-Forwarded-Proto": "https"})
    assert res.headers.get("strict-transport-security") == HSTS_VALUE
    _assert_baseline(res)


def test_mode_none_spoofed_forwarded_proto_with_hsts_disabled_omits_hsts():
    assert settings.TRUSTED_PROXY_MODE == "none"
    assert settings.HSTS_ENABLED is False
    with _client() as c:
        res = c.get(HEALTH_PATH, headers={"X-Forwarded-Proto": "https"})
    assert res.headers.get("strict-transport-security") is None
    _assert_baseline(res)


def test_hsts_setting_loaded_from_centralized_settings():
    assert hasattr(settings, "HSTS_ENABLED")
    assert (
        config_module.Settings.model_fields["HSTS_ENABLED"].default is False
    )
    assert settings.HSTS_ENABLED is False
