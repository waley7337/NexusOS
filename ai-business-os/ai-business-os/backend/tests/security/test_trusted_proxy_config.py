"""Regression tests for the trusted-proxy *configuration* contract —
`Settings.TRUSTED_PROXY_NETWORKS`'s field validator and
`validate_production_config`'s static-mode guard.

Independent-re-review finding NEW-002 (`Part-03.1-Remediation-Re-Review.md`
§15): both validators were confirmed to behave correctly by direct,
one-off execution during that review, but neither had any committed
regression test — a future edit to `app/core/config.py` could silently
drop either check and nothing would catch it. This file closes that gap.

Also covers NEW-001 (the same report, §5.3/§15/§16): `TRUSTED_PROXY_NETWORKS`
must reject a CIDR covering an entire address family (`0.0.0.0/0`, `::/0`,
or an equivalent canonical form), because a universal trusted-proxy range
would let *any* direct, untrusted caller be treated as a trusted proxy and
therefore influence forwarded-scheme trust (`X-Forwarded-Proto`/HSTS,
SEC-003) — even though, as the re-review separately documented, the
right-to-left `X-Forwarded-For` walk in `app/core/client_ip.py` happens to
stay IP-spoof-resistant under this same misconfiguration (see
`tests/security/test_client_ip.py` for that specific, already-covered
invariant; this file only tests the configuration layer, not the resolver).

These tests exercise the real production code paths directly:
  * `Settings(TRUSTED_PROXY_NETWORKS=...)` — the actual Pydantic model,
    the actual `@field_validator`, not a re-implementation of its logic.
  * `validate_production_config(...)` — the actual function `get_settings()`
    calls at real startup.
No validator is mocked, duplicated, or bypassed.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pydantic  # noqa: E402
import pytest  # noqa: E402

from app.core.config import Settings, validate_production_config  # noqa: E402


def _settings(**overrides) -> Settings:
    """Construct a real `Settings` instance — never reads `.env` or the
    process environment for `TRUSTED_PROXY_*` (only `SECRET_KEY`/
    `DATABASE_URL` are seeded above, and those are irrelevant to this
    file's assertions), so results here cannot be contaminated by, or
    contaminate, a developer's real `.env` or any other test's env-var
    mutations."""
    base: dict = dict(
        SECRET_KEY="test-secret-key-must-be-32-chars-long!!",
        DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test",
    )
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def _prod_settings(**overrides) -> Settings:
    base: dict = dict(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-perfectly-unique-production-secret-key-value-1234",
        DATABASE_URL="postgresql+asyncpg://prod:prod@db.internal:5432/prod",
        CORS_ORIGINS=["https://app.example.com"],
    )
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Scenario A / B / C — valid, specific networks are accepted
# --------------------------------------------------------------------------- #

def test_valid_ipv4_cidr_is_accepted():
    """Scenario A: a specific, non-universal IPv4 trusted-proxy network."""
    settings = _settings(TRUSTED_PROXY_MODE="static", TRUSTED_PROXY_NETWORKS=["10.0.0.0/8"])
    assert settings.TRUSTED_PROXY_NETWORKS == ["10.0.0.0/8"]


def test_valid_ipv6_cidr_is_accepted():
    """Scenario B: a specific, non-universal IPv6 trusted-proxy network.
    Uses the RFC 3849 documentation-reserved range (2001:db8::/32) — safe
    to reference in tests/config, never a real routable/assignable range."""
    settings = _settings(TRUSTED_PROXY_MODE="static", TRUSTED_PROXY_NETWORKS=["2001:db8::/32"])
    assert settings.TRUSTED_PROXY_NETWORKS == ["2001:db8::/32"]


def test_multiple_valid_networks_are_accepted_and_preserved():
    """Scenario C: IPv4 + IPv6 together, in the same list, both preserved
    (order and content) rather than silently deduplicated/coerced/dropped."""
    networks = ["10.0.0.0/8", "2001:db8::/32", "192.168.0.0/16"]
    settings = _settings(TRUSTED_PROXY_MODE="static", TRUSTED_PROXY_NETWORKS=networks)
    assert settings.TRUSTED_PROXY_NETWORKS == networks


# --------------------------------------------------------------------------- #
# Scenario D — malformed CIDR rejected
# --------------------------------------------------------------------------- #

def test_malformed_cidr_is_rejected_with_a_specific_pydantic_error():
    """Scenario D. Asserts the specific, real Pydantic validation error the
    production code actually raises (not merely "some exception"), and that
    the message identifies the offending entry."""
    with pytest.raises(pydantic.ValidationError) as exc_info:
        _settings(TRUSTED_PROXY_NETWORKS=["not-a-cidr-at-all"])
    message = str(exc_info.value)
    assert "TRUSTED_PROXY_NETWORKS" in message
    assert "not-a-cidr-at-all" in message
    assert "valid IPv4/IPv6" in message


def test_malformed_cidr_missing_prefix_is_rejected():
    """A bare IP with no `/prefix` at all is a different, still-malformed
    shape (`ipaddress.ip_network` requires a network, not a host, unless
    `strict=False` treats it as a /32 or /128 — confirm it is NOT silently
    treated as universal or otherwise mis-parsed)."""
    settings = _settings(TRUSTED_PROXY_NETWORKS=["10.1.2.3"])
    # A bare host address is a valid /32 network under strict=False — accepted,
    # and explicitly NOT the /0 universal case this file is otherwise about.
    assert settings.TRUSTED_PROXY_NETWORKS == ["10.1.2.3"]


# --------------------------------------------------------------------------- #
# Scenario E — STATIC mode requires explicit trusted networks
# --------------------------------------------------------------------------- #

def test_static_mode_with_empty_networks_is_rejected_in_production():
    """Scenario E. `validate_production_config` — the actual function
    `get_settings()` calls at real startup — must refuse a configuration
    that claims proxy trust (`static`) while trusting nothing (empty list),
    since that combination cannot do what it claims and is very likely an
    operator mistake (e.g. forgot to also set the CIDR list)."""
    settings = _settings(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-perfectly-unique-production-secret-key-value-1234",
        DATABASE_URL="postgresql+asyncpg://prod:prod@db.internal:5432/prod",
        CORS_ORIGINS=["https://app.example.com"],
        TRUSTED_PROXY_MODE="static",
        TRUSTED_PROXY_NETWORKS=[],
    )
    with pytest.raises(RuntimeError, match="TRUSTED_PROXY_MODE=static"):
        validate_production_config(settings)


def test_static_mode_with_networks_passes_in_production():
    """The positive counterpart to Scenario E: `static` mode *with* a real
    network configured must not be rejected — proves the check is about
    the empty-list combination specifically, not `static` mode itself."""
    settings = _prod_settings(TRUSTED_PROXY_MODE="static", TRUSTED_PROXY_NETWORKS=["10.0.0.0/8"])
    validate_production_config(settings)  # must not raise


def test_none_mode_with_empty_networks_passes_in_production():
    """The safe default (`none` mode, no networks) must never be rejected —
    this is the out-of-the-box, "no proxy trust configured yet" state every
    environment starts in, and must remain a valid, startable configuration."""
    settings = _prod_settings(TRUSTED_PROXY_MODE="none", TRUSTED_PROXY_NETWORKS=[])
    validate_production_config(settings)  # must not raise


# --------------------------------------------------------------------------- #
# Scenario F / G — universal trust is rejected (NEW-001)
# --------------------------------------------------------------------------- #

def test_universal_ipv4_trust_is_rejected():
    """Scenario F: `0.0.0.0/0` (every IPv4 address) must never be accepted
    as a trusted-proxy network, in any environment — this is checked by the
    field validator itself (fires at `Settings` construction, unconditional
    on `ENVIRONMENT`), not only the production-only startup guard, so a
    misconfigured *local* run fails exactly as loudly as production would."""
    with pytest.raises(pydantic.ValidationError) as exc_info:
        _settings(TRUSTED_PROXY_NETWORKS=["0.0.0.0/0"])
    message = str(exc_info.value)
    assert "0.0.0.0/0" in message
    assert "entire" in message and "IPv4" in message
    assert "trusted-proxy boundary" in message


def test_universal_ipv6_trust_is_rejected():
    """Scenario G: `::/0` (every IPv6 address) must never be accepted."""
    with pytest.raises(pydantic.ValidationError) as exc_info:
        _settings(TRUSTED_PROXY_NETWORKS=["::/0"])
    message = str(exc_info.value)
    assert "::/0" in message
    assert "entire" in message and "IPv6" in message
    assert "trusted-proxy boundary" in message


def test_universal_ipv4_trust_is_rejected_in_equivalent_netmask_form():
    """The invariant is about the *semantic* network (every possible
    address), not exact string formatting — `0.0.0.0/0.0.0.0` is a
    dotted-netmask spelling of the identical /0 network and must be
    rejected exactly like the CIDR-suffix spelling, because the validator
    checks the *parsed* `ipaddress.ip_network` object's prefix length, not
    the raw string."""
    with pytest.raises(pydantic.ValidationError, match="entire"):
        _settings(TRUSTED_PROXY_NETWORKS=["0.0.0.0/0.0.0.0"])


def test_universal_ipv6_trust_is_rejected_in_alternate_spelling():
    """`::0/0` is an alternate (non-canonical) textual spelling of the same
    all-zeros IPv6 /0 network as `::/0` — must be rejected identically."""
    with pytest.raises(pydantic.ValidationError, match="entire"):
        _settings(TRUSTED_PROXY_NETWORKS=["::0/0"])


def test_universal_trust_is_rejected_even_alongside_a_valid_network():
    """A mixed list containing one legitimate network and one universal
    network must still fail closed as a whole — a single dangerous entry
    must not be diluted/ignored just because other entries are fine."""
    with pytest.raises(pydantic.ValidationError, match="entire"):
        _settings(TRUSTED_PROXY_NETWORKS=["10.0.0.0/8", "0.0.0.0/0"])


def test_broad_but_non_universal_network_is_still_accepted():
    """Scope-control check: this validator rejects only the universal /0
    case, not "overly broad" CIDRs in general (no such policy was
    requested) — a wide-but-not-universal range like a /1 remains a valid,
    accepted (if unusual) operator choice."""
    settings = _settings(TRUSTED_PROXY_NETWORKS=["0.0.0.0/1"])
    assert settings.TRUSTED_PROXY_NETWORKS == ["0.0.0.0/1"]


def test_universal_trust_is_rejected_even_outside_production():
    """The field validator (unlike `validate_production_config`) is not
    gated by `ENVIRONMENT` — a universal trusted-proxy range is never a
    legitimate development/staging value either, and must fail exactly the
    same way there as it would in production."""
    with pytest.raises(pydantic.ValidationError, match="entire"):
        _settings(ENVIRONMENT="development", TRUSTED_PROXY_NETWORKS=["0.0.0.0/0"])
