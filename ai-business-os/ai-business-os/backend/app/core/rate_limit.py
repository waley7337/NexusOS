"""Redis-backed rate limiting for high-risk, unauthenticated endpoints.

Scope (P1 — infrastructure already exists: `redis` is a declared dependency
and `REDIS_URL` is already configured): login, register, forgot-password,
reset-password, and refresh. These are the endpoints an attacker can hit
without holding any credential, so IP-based limiting is the right default
axis (a per-user limit doesn't help until *after* authentication succeeds).

Client-identity resolution (Part 3.1 remediation, SEC-001): the rate-limit
key is derived from `app.core.client_ip.resolve_client_identity()`, the one
centralized trusted-proxy boundary in this codebase. This module does not
parse `X-Forwarded-For` itself — see `client_ip.py` for the full algorithm
and rationale. Practical effect: with the safe-by-default
`TRUSTED_PROXY_MODE=none`, behavior is unchanged from before this
remediation (the real TCP peer is always the key); once a deployment
verifies and configures its real edge/proxy CIDR ranges via
`TRUSTED_PROXY_NETWORKS`, distinct real clients behind that trusted proxy
resolve to distinct rate-limit buckets instead of all colliding into one.

Design notes:
  * Fixed-window counter via `INCR` + `EXPIRE` — the simplest correct
    primitive for this, and atomic enough for rate limiting (a rare
    boundary double-count is an acceptable trade for avoiding Lua scripts
    or transactions here).
  * One shared `redis.asyncio` client, created lazily and reused across
    requests (a connection pool, not one connection per request).
  * Fails OPEN on Redis errors (connection refused, timeout, etc.), logging
    a warning. Rationale: Redis being down must not become an auth outage —
    availability of the login flow outweighs rate-limit enforcement during
    an infrastructure incident. This is a deliberate, documented trade-off,
    not an oversight.
  * Never a fake in-memory limiter: a single-process counter would silently
    stop working the moment the app runs behind more than one instance,
    which is worse than an honestly-absent limiter. Redis is the only
    backing store used, matching how this would run in production.
"""
import time

import structlog
from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.client_ip import resolve_client_identity
from app.core.config import settings
from app.core.exceptions import RateLimitExceededError

logger = structlog.get_logger("app.rate_limit")

_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            str(settings.REDIS_URL),
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _redis_client


async def close_redis_client() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


class RateLimiter:
    """Fixed-window limiter: `limit` requests per `window_seconds`, keyed by
    an arbitrary caller-supplied identity string (IP, email, etc.)."""

    def __init__(self, redis: Redis, *, limit: int, window_seconds: int):
        self.redis = redis
        self.limit = limit
        self.window_seconds = window_seconds

    async def check(self, key: str) -> None:
        """Raises `RateLimitExceededError` if `key` has exceeded its budget
        for the current window. Fails open (allows the request) on any
        Redis-level error, logging a warning rather than raising."""
        window = int(time.time()) // self.window_seconds
        redis_key = f"ratelimit:{key}:{window}"
        try:
            count = await self.redis.incr(redis_key)
            if count == 1:
                # Only the request that created the counter sets its TTL —
                # avoids resetting the window's expiry on every hit.
                await self.redis.expire(redis_key, self.window_seconds)
        except RedisError:
            logger.warning("rate_limit.backend_unavailable", key_prefix=key.split(":")[0])
            return

        if count > self.limit:
            raise RateLimitExceededError(
                details={"retry_after_seconds": self.window_seconds}
            )


def rate_limit(key_prefix: str, *, limit: int | None = None, window_seconds: int = 60):
    """FastAPI dependency factory: `Depends(rate_limit("login", limit=10))`.

    Keys by resolved client IP — the only identity available before
    authentication succeeds — via the centralized trusted-proxy boundary in
    `app.core.client_ip`. See that module for exactly when/how a forwarded
    header can influence the resolved IP; this dependency never parses one
    itself.
    """
    effective_limit = limit if limit is not None else settings.RATE_LIMIT_PER_MINUTE

    async def dependency(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        identity = resolve_client_identity(request)
        client_key = identity.resolved_ip or "unknown"
        redis = get_redis_client()
        limiter = RateLimiter(redis, limit=effective_limit, window_seconds=window_seconds)
        await limiter.check(f"{key_prefix}:{client_key}")

    return dependency
