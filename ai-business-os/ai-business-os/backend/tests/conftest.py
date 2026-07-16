"""Collected by pytest before any test module in this tree, and therefore
before `app.core.config.settings` (a module-level singleton) is ever
instantiated — the right place for process-wide test-environment env vars.

`RATE_LIMIT_ENABLED=false`: every `TestClient` request shares the same
synthetic "testclient" peer host, so per-IP rate limiting would trip across
*unrelated* tests that happen to hit `/auth/login`, `/auth/register`, etc.
many times in one run. The limiter's actual logic is proven directly by
`tests/security/test_rate_limiting.py`, which talks to `RateLimiter` without
going through the API — this flag only avoids a false-positive interaction
in unrelated end-to-end tests, it does not skip testing the feature itself.
"""
import os

os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
