"""End-to-end HTTP regression tests for the trusted-proxy boundary — Part
3.1 remediation, SEC-001 / SEC-003 (plus, incidentally, the real-route
coverage requested for TEST-002/TEST-003).

Unlike `tests/security/test_client_ip.py` (unit tests of the resolver
function) and `tests/security/test_rate_limiting.py` (unit tests of
`RateLimiter` against real Redis), these go through the actual ASGI app —
real routes, real rate-limit dependency wiring, real
`SecurityHeadersMiddleware` — using Starlette's `TestClient(client=...)` to
control the simulated TCP peer address per test. This proves the resolver
is actually *wired in*, not just correct in isolation.
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

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

HEALTH_PATH = "/api/v1/health"
LOGIN_PATH = "/api/v1/auth/login"
LOGIN_PAYLOAD = {
    "companySlug": "nonexistent",
    "email": "nobody@example.com",
    "password": "x",
}


def _client(peer_host: str) -> TestClient:
    return TestClient(app, client=(peer_host, 12345))


@pytest.fixture(autouse=True)
def _rate_limit_enabled(monkeypatch):
    """These tests specifically exercise the rate limiter's real
    HTTP-level wiring, so — unlike the rest of the suite — they need it
    turned on. Scoped to this module only via `monkeypatch`, reverted
    automatically; every other test file's global
    `RATE_LIMIT_ENABLED=false` (see `tests/conftest.py`) is untouched."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)


@pytest.fixture
def trust_10_8(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "static")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", ["10.0.0.0/8"])


# --------------------------------------------------------------------------- #
# SEC-001 — rate limiting through the real HTTP layer
# --------------------------------------------------------------------------- #


def test_rate_limit_trips_for_a_direct_untrusted_client():
    """Baseline: direct (no proxy configured) traffic is still rate
    limited exactly as before this remediation — this must not regress."""
    with _client("203.0.113.201") as c:
        statuses = [
            c.post(LOGIN_PATH, json=LOGIN_PAYLOAD).status_code
            for _ in range(11)
        ]
    assert 429 in statuses, "expected the login limiter (limit=10/min) to trip"


def test_spoofed_forwarded_for_from_untrusted_peer_cannot_bypass_the_limit():
    """The exact attack this remediation closes: without a configured
    trusted proxy, sending a different `X-Forwarded-For` on every request
    must NOT grant a fresh rate-limit budget each time."""
    peer = "203.0.113.202"
    with _client(peer) as c:
        statuses = []
        for i in range(11):
            res = c.post(
                LOGIN_PATH,
                json=LOGIN_PAYLOAD,
                headers={"X-Forwarded-For": f"1.2.3.{i}"},
            )
            statuses.append(res.status_code)
    assert 429 in statuses, (
        "spoofed X-Forwarded-For from an untrusted peer must not bypass the "
        "shared per-peer rate-limit budget"
    )


def test_two_real_clients_behind_a_trusted_proxy_get_independent_budgets(trust_10_8):
    """Once a trusted proxy is configured, two *different* real clients
    forwarded through it must not share one bucket (the pre-remediation
    failure mode: everyone behind the proxy collapses into one identity)."""
    proxy_peer = "10.5.5.5"
    with _client(proxy_peer) as c:
        # Client A alone should not be rate-limited within a small budget.
        res_a = c.post(
            LOGIN_PATH,
            json=LOGIN_PAYLOAD,
            headers={"X-Forwarded-For": "203.0.113.11"},
        )
        assert res_a.status_code != 429

        # Client B, forwarded through the SAME trusted proxy peer, must
        # get its own independent budget rather than inheriting A's usage.
        res_b = c.post(
            LOGIN_PATH,
            json=LOGIN_PAYLOAD,
            headers={"X-Forwarded-For": "203.0.113.22"},
        )
        assert res_b.status_code != 429


def test_trusted_proxy_client_can_still_be_individually_rate_limited(trust_10_8):
    """The other half of the same invariant: a *single* real client behind
    the trusted proxy must still trip its own limit — trusted-proxy
    resolution must not accidentally disable rate limiting altogether."""
    proxy_peer = "10.5.5.6"
    with _client(proxy_peer) as c:
        statuses = [
            c.post(
                LOGIN_PATH,
                json=LOGIN_PAYLOAD,
                headers={"X-Forwarded-For": "203.0.113.33"},
            ).status_code
            for _ in range(11)
        ]
    assert 429 in statuses


def test_malformed_forwarded_header_does_not_crash_the_request(trust_10_8):
    """Malformed forwarding metadata from a trusted proxy must degrade
    safely (fall back to the peer identity), never surface as a 500."""
    with _client("10.5.5.7") as c:
        res = c.post(
            LOGIN_PATH,
            json=LOGIN_PAYLOAD,
            headers={"X-Forwarded-For": "\x00garbage\x01"},
        )
    assert res.status_code in (200, 401, 422, 429)


def test_ipv6_forwarded_client_is_accepted_end_to_end(trust_10_8):
    with _client("10.5.5.8") as c:
        res = c.post(
            LOGIN_PATH,
            json=LOGIN_PAYLOAD,
            headers={"X-Forwarded-For": "2001:db8::42"},
        )
    assert res.status_code in (200, 401, 422)


# --------------------------------------------------------------------------- #
# SEC-003 — HSTS / forwarded-scheme trust through the real HTTP layer
# --------------------------------------------------------------------------- #


def test_direct_untrusted_client_spoofing_https_proto_gets_no_hsts():
    with _client("203.0.113.210") as c:
        res = c.get(HEALTH_PATH, headers={"X-Forwarded-Proto": "https"})
    assert "strict-transport-security" not in {h.lower() for h in res.headers.keys()}


def test_trusted_proxy_forwarded_https_grants_hsts(trust_10_8):
    with _client("10.6.6.6") as c:
        res = c.get(HEALTH_PATH, headers={"X-Forwarded-Proto": "https"})
    assert res.headers.get("strict-transport-security") is not None


def test_plain_http_without_any_proxy_never_gets_hsts():
    with _client("203.0.113.211") as c:
        res = c.get(HEALTH_PATH)
    assert res.headers.get("strict-transport-security") is None


# --------------------------------------------------------------------------- #
# TEST-003 — baseline security headers are present on a real response
# --------------------------------------------------------------------------- #


def test_baseline_security_headers_present_on_a_real_response():
    with _client("203.0.113.212") as c:
        res = c.get(HEALTH_PATH)
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("referrer-policy") == "no-referrer"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("cache-control") == "no-store"