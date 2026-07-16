"""Unit tests for `app.core.rate_limit.RateLimiter`, exercised directly
against a real Redis instance (not through the API — see `conftest.py` for
why `RATE_LIMIT_ENABLED=false` in the test environment). Skipped when Redis
isn't reachable, mirroring the DB-test skip pattern used elsewhere.
"""
import os
import uuid

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")


def _redis_available() -> bool:
    try:
        from redis import Redis as SyncRedis

        SyncRedis.from_url(REDIS_URL, socket_connect_timeout=1).ping()
        return True
    except Exception:  # noqa: BLE001
        return False


pytestmark = pytest.mark.skipif(not _redis_available(), reason="redis not available")

from redis.asyncio import Redis  # noqa: E402

from app.core.exceptions import RateLimitExceededError  # noqa: E402
from app.core.rate_limit import RateLimiter  # noqa: E402


@pytest.fixture
def redis_key_prefix():
    """Unique per test so parallel/repeated runs never share a counter."""
    return f"test:{uuid.uuid4().hex}"


@pytest.mark.asyncio
async def test_requests_within_limit_are_allowed(redis_key_prefix):
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    limiter = RateLimiter(redis, limit=5, window_seconds=60)
    for _ in range(5):
        await limiter.check(redis_key_prefix)  # must not raise
    await redis.aclose()


@pytest.mark.asyncio
async def test_request_beyond_limit_is_rejected(redis_key_prefix):
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    limiter = RateLimiter(redis, limit=3, window_seconds=60)
    for _ in range(3):
        await limiter.check(redis_key_prefix)
    with pytest.raises(RateLimitExceededError):
        await limiter.check(redis_key_prefix)
    await redis.aclose()


@pytest.mark.asyncio
async def test_different_keys_have_independent_budgets(redis_key_prefix):
    """Tenant/IP isolation for the limiter itself: exhausting one identity's
    budget must never affect a different identity's."""
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    limiter = RateLimiter(redis, limit=1, window_seconds=60)
    await limiter.check(f"{redis_key_prefix}:a")
    with pytest.raises(RateLimitExceededError):
        await limiter.check(f"{redis_key_prefix}:a")
    await limiter.check(f"{redis_key_prefix}:b")  # different identity, untouched budget
    await redis.aclose()


@pytest.mark.asyncio
async def test_fails_open_when_redis_unavailable(redis_key_prefix):
    """Redis being down must not become an auth outage — availability of the
    login flow outweighs rate-limit enforcement during an infra incident."""
    unreachable = Redis.from_url(
        "redis://127.0.0.1:1/0", socket_connect_timeout=1, socket_timeout=1
    )
    limiter = RateLimiter(unreachable, limit=1, window_seconds=60)
    await limiter.check(redis_key_prefix)  # must not raise despite unreachable backend
    await limiter.check(redis_key_prefix)  # even repeatedly
    await unreachable.aclose()
