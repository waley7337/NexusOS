"""Centralized, explicit trusted-proxy boundary (Part 3.1 remediation —
SEC-001 / SEC-003).

Every place in the codebase that needs "the client's IP" or "was this
request over HTTPS" for a *security* decision (rate limiting, HSTS,
audit `ip_address`) must go through `resolve_client_identity()` here.
Nothing else may parse `X-Forwarded-For`/`X-Forwarded-Proto` directly —
that was the root cause of SEC-003 (security_headers.py trusted
`X-Forwarded-Proto` unconditionally while rate_limit.py correctly refused to
trust `X-Forwarded-For`): two different, inconsistent trust decisions
scattered across two files. One module, one policy, now.

The invariant this module enforces:

    UNTRUSTED IMMEDIATE PEER  + CLIENT-SUPPLIED FORWARDED HEADER
        = HEADER IGNORED (peer IP is the client IP, full stop)

    TRUSTED IMMEDIATE PEER    + VALID FORWARDED METADATA
        = client IP resolved from that metadata, per policy below

"Trusted" is never inferred from a header — it is decided *only* by
whether `request.client.host` (the real TCP peer address Starlette/uvicorn
observed — not anything client-supplied) falls inside
`settings.TRUSTED_PROXY_NETWORKS`, and only when
`settings.TRUSTED_PROXY_MODE == "static"`. The default (`"none"`) trusts
nothing, ever, regardless of what `TRUSTED_PROXY_NETWORKS` contains — see
`app/core/config.py` for why that double-gate exists.

Forwarded-chain resolution algorithm (when the immediate peer *is*
trusted):

  `X-Forwarded-For` is a comma-separated list that each hop *appends to*
  (never prepends) as a request passes through it: `client, proxy1, proxy2`.
  The right-most entry is therefore always the address the *closest* hop
  observed — which is the only entry we can trust without also trusting
  every hop to our left. We walk the list right-to-left:

    * an entry that itself falls inside a trusted network is *another*
      trusted proxy hop — keep walking left through it;
    * the first entry that does NOT fall inside a trusted network is the
      resolved client IP — stop there;
    * a malformed entry stops the walk immediately and falls back to
      whatever was resolved so far (never crashes, never guesses).

  This is why the classic spoofing attempt fails: an attacker who sends
  `X-Forwarded-For: 1.1.1.1` straight to the trusted edge has that value
  placed at the *left* of the list, with the edge appending the attacker's
  own real connecting address to the *right* before forwarding to us.
  Walking right-to-left finds the attacker's real address first (not a
  trusted network) and stops — `1.1.1.1` on the left is never reached.
  An attacker who bypasses the edge and connects to us directly is caught
  even earlier: their own peer address will not be in
  `TRUSTED_PROXY_NETWORKS` at all, so the header is ignored outright.

`X-Forwarded-Proto` uses the same trust gate (only consulted when the
immediate peer is trusted) but is a single value, not a chain.
"""
import ipaddress
from dataclasses import dataclass

from starlette.requests import Request

from app.core.config import settings

IpAddress = ipaddress.IPv4Address | ipaddress.IPv6Address
IpNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network

# Defensive bounds on the *request-supplied* forwarding chain — this data
# comes from the wire, so unlike TRUSTED_PROXY_NETWORKS (operator config,
# validated at startup) it must degrade safely, never raise, no matter how
# malformed or oversized it is.
_MAX_FORWARDED_HOPS = 20
_MAX_HEADER_LEN = 2048


@dataclass(frozen=True)
class ClientIdentity:
    """Result of resolving a request's client identity through the trust
    boundary. Callers that need "the" client IP for a security decision
    should use `resolved_ip`; `peer_ip` is kept alongside for logging/
    diagnostics so the two concepts are never accidentally conflated."""

    peer_ip: str | None
    resolved_ip: str | None
    via_trusted_proxy: bool
    scheme: str


def _parse_ip(raw: str) -> IpAddress | None:
    """Parse one address, defensively stripping a `[v6]:port` or
    `v4:port` suffix if present (some proxies append a port to forwarded
    entries even though the header spec doesn't require one). Returns
    `None` — never raises — on anything unparseable."""
    value = raw.strip()
    if not value:
        return None
    if value.startswith("["):
        # "[::1]:8000" or plain "[::1]"
        end = value.find("]")
        if end == -1:
            return None
        value = value[1:end]
    elif value.count(":") == 1 and value.count(".") >= 1:
        # "1.2.3.4:8000" — a single colon alongside dots means IPv4:port,
        # never a bare IPv6 literal (those have >= 2 colons, or 0 if
        # someone passed a v4-mapped form we don't special-case here).
        value = value.split(":", 1)[0]
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None


def _trusted_networks() -> tuple[IpNetwork, ...]:
    """Deliberately *not* cached across calls: `settings.TRUSTED_PROXY_*`
    must be safely overridable per-test (dependency/attribute overrides),
    and re-parsing a handful of CIDR strings per request is not a
    meaningful cost. Invalid entries cannot reach here in a real deployment
    at all — `Settings` fails fast at startup (see
    `_validate_trusted_proxy_networks`) — so no per-entry error handling is
    needed here either."""
    if settings.TRUSTED_PROXY_MODE != "static":
        return ()
    return tuple(
        ipaddress.ip_network(raw, strict=False) for raw in settings.TRUSTED_PROXY_NETWORKS
    )


def _is_trusted_proxy(ip: IpAddress) -> bool:
    networks = _trusted_networks()
    return any(ip in net for net in networks)


def _resolve_forwarded_client_ip(header_value: str, peer_ip_raw: str | None) -> str | None:
    """Walk `X-Forwarded-For` right-to-left through trusted hops. Returns
    `peer_ip_raw` unchanged if the header is empty, oversized, malformed at
    the first (right-most) entry, or entirely made of trusted-proxy hops
    with nothing else behind them."""
    if not header_value or len(header_value) > _MAX_HEADER_LEN:
        return peer_ip_raw

    hops = [h for h in (part.strip() for part in header_value.split(",")) if h]
    if not hops or len(hops) > _MAX_FORWARDED_HOPS:
        return peer_ip_raw

    for hop in reversed(hops):
        hop_ip = _parse_ip(hop)
        if hop_ip is None:
            # Malformed entry — stop walking rather than guess past it.
            return peer_ip_raw
        if _is_trusted_proxy(hop_ip):
            continue  # another known proxy hop; keep walking left
        return str(hop_ip)

    # Every hop in the chain was itself a trusted proxy — nothing beyond
    # them was presented. Fall back to the immediate peer.
    return peer_ip_raw


def resolve_client_identity(request: Request) -> ClientIdentity:
    """The single entry point every caller (rate limiter, security
    headers, audit IP capture) must use instead of reading
    `request.client.host` / `X-Forwarded-For` / `X-Forwarded-Proto`
    directly."""
    peer_ip_raw = request.client.host if request.client else None
    peer_ip_parsed = _parse_ip(peer_ip_raw) if peer_ip_raw else None
    trusted = peer_ip_parsed is not None and _is_trusted_proxy(peer_ip_parsed)

    if not trusted:
        return ClientIdentity(
            peer_ip=peer_ip_raw,
            resolved_ip=peer_ip_raw,
            via_trusted_proxy=False,
            scheme=request.url.scheme,
        )

    resolved_ip = _resolve_forwarded_client_ip(
        request.headers.get("x-forwarded-for", ""), peer_ip_raw
    )

    scheme = request.url.scheme
    forwarded_proto = request.headers.get("x-forwarded-proto", "").strip().lower()
    if forwarded_proto in ("http", "https"):
        scheme = forwarded_proto

    return ClientIdentity(
        peer_ip=peer_ip_raw,
        resolved_ip=resolved_ip,
        via_trusted_proxy=True,
        scheme=scheme,
    )
