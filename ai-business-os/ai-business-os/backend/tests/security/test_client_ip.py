"""Regression tests for the centralized trusted-proxy boundary
(`app.core.client_ip`) — Part 3.1 remediation, SEC-001 / SEC-003.

These are unit tests of the resolution algorithm itself, constructing real
Starlette `Request` objects (not mocks) with a controlled ASGI scope so the
exact `client`/headers combination under test is explicit. See
`tests/security/test_trusted_proxy_http.py` for the same invariants proven
through a real HTTP round-trip against the actual app and rate limiter.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.core import client_ip  # noqa: E402
from app.core.config import settings  # noqa: E402


def _request(client_host: str | None, headers: dict[str, str] | None = None, scheme: str = "http") -> Request:
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": raw_headers,
        "client": (client_host, 12345) if client_host is not None else None,
        "scheme": scheme,
        "server": ("test", 80),
        "query_string": b"",
    }
    return Request(scope)


@pytest.fixture
def trust_10_8(monkeypatch):
    """Trust the 10.0.0.0/8 network as a proxy, for the duration of one
    test — never a global/session-wide change, so untouched tests keep the
    safe `TRUSTED_PROXY_MODE=none` default."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "static")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", ["10.0.0.0/8"])


def test_default_mode_trusts_nothing():
    """Safe-by-default: even a peer that *looks* like a private/proxy
    address is not trusted unless TRUSTED_PROXY_MODE is explicitly set."""
    assert settings.TRUSTED_PROXY_MODE == "none"
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "1.1.1.1"})
    )
    assert identity.via_trusted_proxy is False
    assert identity.resolved_ip == "10.1.2.3"


def test_untrusted_peer_forwarded_for_is_ignored(trust_10_8):
    """The exact attack from the remediation brief: an attacker who is not
    connecting through a trusted proxy must never be believed to be
    `1.1.1.1` just because they said so."""
    identity = client_ip.resolve_client_identity(
        _request("203.0.113.9", {"x-forwarded-for": "1.1.1.1"})
    )
    assert identity.via_trusted_proxy is False
    assert identity.resolved_ip == "203.0.113.9"
    assert identity.resolved_ip != "1.1.1.1"


def test_untrusted_peer_forwarded_proto_is_ignored(trust_10_8):
    """SEC-003: a direct, untrusted caller must not be able to flip the
    resolved scheme to https merely by sending the header."""
    identity = client_ip.resolve_client_identity(
        _request("203.0.113.9", {"x-forwarded-proto": "https"}, scheme="http")
    )
    assert identity.scheme == "http"


def test_trusted_proxy_resolves_real_client_ip(trust_10_8):
    """The proxy appends the real client's address to the right of
    whatever arrived on the left — resolving from the right defeats a
    client that pre-seeded the header with a forged value."""
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "1.1.1.1, 203.0.113.55"})
    )
    assert identity.via_trusted_proxy is True
    assert identity.resolved_ip == "203.0.113.55"
    assert identity.resolved_ip != "1.1.1.1"


def test_trusted_proxy_forwarded_proto_is_honored(trust_10_8):
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-proto": "https"}, scheme="http")
    )
    assert identity.scheme == "https"


def test_two_different_real_clients_resolve_to_different_identities(trust_10_8):
    """The whole point of resolving through the proxy: distinct real
    clients must not collapse into one identity (e.g. for rate-limit
    bucketing) just because they share the same trusted proxy hop."""
    a = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "203.0.113.10"})
    )
    b = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "203.0.113.20"})
    )
    assert a.resolved_ip != b.resolved_ip
    assert a.resolved_ip == "203.0.113.10"
    assert b.resolved_ip == "203.0.113.20"


def test_chained_trusted_proxies_walks_past_the_inner_hop(trust_10_8):
    """A second, *also-trusted* hop in the chain must be walked past, not
    mistaken for the client."""
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "203.0.113.77, 10.9.9.9"})
    )
    assert identity.resolved_ip == "203.0.113.77"


def test_malformed_forwarded_ip_fails_safe_not_crash(trust_10_8):
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "not-an-ip-at-all"})
    )
    assert identity.resolved_ip == "10.1.2.3"  # falls back to the peer, no exception


def test_empty_forwarded_header_fails_safe(trust_10_8):
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": ""})
    )
    assert identity.resolved_ip == "10.1.2.3"


def test_oversized_forwarded_chain_fails_safe(trust_10_8):
    """A chain far longer than any real deployment would produce must be
    rejected outright, not parsed hop-by-hop (a cheap way to keep parsing
    cost bounded regardless of how large a client makes the header)."""
    huge_chain = ", ".join(["203.0.113.1"] * 50)
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": huge_chain})
    )
    assert identity.resolved_ip == "10.1.2.3"


def test_oversized_forwarded_header_string_fails_safe(trust_10_8):
    huge_value = "1.2.3.4, " * 2000  # far past _MAX_HEADER_LEN in raw length
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": huge_value})
    )
    assert identity.resolved_ip == "10.1.2.3"


def test_ipv4_forwarded_client_resolves(trust_10_8):
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "198.51.100.23"})
    )
    assert identity.resolved_ip == "198.51.100.23"


def test_ipv6_forwarded_client_resolves(trust_10_8):
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "2001:db8::1"})
    )
    assert identity.resolved_ip == "2001:db8::1"


def test_ipv6_trusted_proxy_network(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "static")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", ["fd00::/8"])
    identity = client_ip.resolve_client_identity(
        _request("fd00::1", {"x-forwarded-for": "203.0.113.44"})
    )
    assert identity.via_trusted_proxy is True
    assert identity.resolved_ip == "203.0.113.44"


def test_forwarded_ip_with_port_suffix_is_stripped(trust_10_8):
    """Some proxies append a port to forwarded entries even though the
    header spec doesn't require one — must not be mistaken for part of
    the address or cause a parse failure."""
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "203.0.113.66:54321"})
    )
    assert identity.resolved_ip == "203.0.113.66"


def test_missing_client_information_fails_safe():
    """No TCP peer at all (can legitimately happen for certain ASGI
    transports) must resolve to `None`, never raise."""
    identity = client_ip.resolve_client_identity(_request(None))
    assert identity.peer_ip is None
    assert identity.resolved_ip is None
    assert identity.via_trusted_proxy is False


def test_direct_development_request_is_unaffected_by_default():
    """Local dev / CI without any trusted-proxy configuration: behavior is
    identical to before this remediation — the real peer is used as-is,
    headers are never consulted."""
    identity = client_ip.resolve_client_identity(
        _request("127.0.0.1", {"x-forwarded-for": "9.9.9.9", "x-forwarded-proto": "https"})
    )
    assert identity.resolved_ip == "127.0.0.1"
    assert identity.scheme == "http"
    assert identity.via_trusted_proxy is False


def test_trusted_proxy_mode_static_with_empty_networks_trusts_nothing(monkeypatch):
    """A misconfiguration guard at the resolution layer itself (in addition
    to `validate_production_config`'s startup check): `static` mode with no
    networks configured must not accidentally trust every peer."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_MODE", "static")
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", [])
    identity = client_ip.resolve_client_identity(
        _request("10.1.2.3", {"x-forwarded-for": "1.1.1.1"})
    )
    assert identity.via_trusted_proxy is False
    assert identity.resolved_ip == "10.1.2.3"
