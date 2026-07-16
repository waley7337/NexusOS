"""Regression tests for production exception-log rendering — Part 3.1
remediation, OBS-001.

Root cause (confirmed by direct reproduction before this fix): structlog's
`logger.exception(...)` sets `exc_info=True` in the event dict.
`ConsoleRenderer` (dev) special-cases that key and pretty-prints the
traceback; `JSONRenderer` (production) does not, and previously serialized
the *literal boolean* `"exc_info": true` with no exception type, message,
or traceback anywhere in the log line. Every unhandled 500 in production
was therefore undiagnosable from logs alone.

These tests exercise the actual production-style pipeline
(`configure_logging()` with `ENVIRONMENT=production`), not just dev's
already-working ConsoleRenderer path. Every test that flips
`settings.ENVIRONMENT` does so through the shared `production_json_logging`
fixture, which is the *only* place that reconfigures the (process-global)
structlog pipeline and reverts it — so a failure partway through a test
can never leave a later, unrelated test running against the wrong
renderer.
"""
import io
import json
import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import structlog  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.core.config import settings  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.main import app  # noqa: E402
from app.main import logger as _app_logger  # noqa: E402
from app.services import auth_service  # noqa: E402


def _reset_logger_cache(logger: structlog.BoundLoggerLazyProxy) -> None:
    """Bust structlog's `cache_logger_on_first_use` cache for one specific
    module-level logger proxy.

    Root cause this works around (confirmed by direct reproduction against
    structlog 24.4.0's `BoundLoggerLazyProxy.bind()`): the *first* time any
    given `structlog.get_logger(...)` proxy is actually used, it monkeypatches
    its own instance `.bind` attribute to a closure over whatever the global
    config was *at that moment* — every later `structlog.configure()` call is
    then silently ignored by that specific proxy forever. `app.main.logger`
    gets first-used the moment the very first test in the whole suite spins
    up a `TestClient(app)` (dev-mode ConsoleRenderer), so this fixture's own
    `configure_logging()` call has no effect on it without this reset —
    deleting the instance-level `bind` override restores the class-level
    `bind`, which re-reads the *current* global config on next use. This is a
    test-isolation fix only; production's `cache_logger_on_first_use=True`
    behavior in `app/core/logging.py` is untouched and still correct there,
    since production never dynamically reconfigures logging mid-process."""
    if "bind" in vars(logger):
        del logger.bind


@pytest.fixture
def production_json_logging(monkeypatch):
    """Reconfigure the real (process-global) structlog pipeline to the
    production JSONRenderer chain for exactly the duration of one test,
    then restore the dev ConsoleRenderer chain the rest of the suite
    relies on — `monkeypatch.undo()` is called explicitly, *before* the
    restoring `configure_logging()`, so that call actually observes
    `ENVIRONMENT` back at its original value rather than still-patched
    "production"."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.is_production is True
    configure_logging()
    _reset_logger_cache(_app_logger)
    yield
    monkeypatch.undo()
    configure_logging()
    _reset_logger_cache(_app_logger)


def _capture_stdout_json_lines(fn) -> list[dict]:
    """Runs `fn()` with stdout captured, parsing every JSON-shaped line
    structlog's PrintLoggerFactory wrote."""
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        fn()
    finally:
        sys.stdout = real_stdout
    lines = [line for line in buf.getvalue().splitlines() if line.strip()]
    parsed = []
    for line in lines:
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return parsed


def test_production_pipeline_renders_exception_type_message_and_traceback(
    production_json_logging,
):
    """Direct reproduction of the exact failure mode: with the real
    production chain active, log an exception the same way the catch-all
    handler does, and prove the JSON line now carries real diagnostic
    content instead of a bare `exc_info: true`."""

    def _do_logging():
        logger = structlog.get_logger("test.obs001")
        try:
            raise ValueError("distinctive-marker-obs001-boom")
        except ValueError:
            logger.exception("unhandled_error")

    events = _capture_stdout_json_lines(_do_logging)

    assert len(events) == 1
    event = events[0]

    assert "exception" in event
    traceback_text = event["exception"]
    assert isinstance(traceback_text, str)
    assert "ValueError" in traceback_text  # exception type
    assert "distinctive-marker-obs001-boom" in traceback_text  # exception message
    assert "Traceback (most recent call last)" in traceback_text  # actual traceback
    assert event.get("exc_info") is not True, "raw exc_info=True must not leak through unrendered"


def test_production_pipeline_still_redacts_sensitive_kwargs(production_json_logging):
    """The fix must not disturb the existing redaction processor —
    sensitive *structured* fields passed alongside an exception must still
    come out scrubbed."""

    def _do_logging():
        logger = structlog.get_logger("test.obs001")
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            logger.exception(
                "unhandled_error",
                password="super-secret-pw",
                access_token="abc.def.ghi",
                authorization="Bearer zzz",
            )

    events = _capture_stdout_json_lines(_do_logging)

    assert len(events) == 1
    event = events[0]
    assert event["password"] == "***REDACTED***"
    assert event["access_token"] == "***REDACTED***"
    assert event["authorization"] == "***REDACTED***"
    # The traceback itself is still present and useful — redaction of
    # unrelated structured fields must not have suppressed it.
    assert "RuntimeError" in event["exception"]


def test_production_pipeline_correlates_request_id_via_contextvars(production_json_logging):
    """`RequestContextMiddleware` binds `request_id` into structlog
    contextvars before the route runs; the exception log line must still
    carry it (via `merge_contextvars`, already in the shared processor
    chain — this proves the OBS-001 fix didn't disturb that)."""

    def _do_logging():
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id="corr-test-req-id")
        logger = structlog.get_logger("test.obs001")
        try:
            raise RuntimeError("boom")
        except RuntimeError:
            logger.exception("unhandled_error")
        structlog.contextvars.clear_contextvars()

    events = _capture_stdout_json_lines(_do_logging)

    assert len(events) == 1
    assert events[0]["request_id"] == "corr-test-req-id"


def test_unhandled_exception_end_to_end_logs_detail_but_client_gets_generic_error(
    production_json_logging, monkeypatch
):
    """Full round-trip: force a real route to raise, through the real
    FastAPI catch-all handler, with the actual production JSON pipeline
    active. The HTTP client must receive a safe generic message and no
    trace of the internal exception; the server-side log (captured via
    stdout) must contain the real exception, correlated with the same
    request id returned in the response header.

    `Starlette.ServerErrorMiddleware` sends the handled response to the
    client and *then* re-raises the original exception (by design, so a
    real ASGI server's own error logging still sees it) — `TestClient`'s
    default `raise_server_exceptions=True` surfaces that re-raise straight
    into the test process. Disabled here deliberately: we're asserting on
    the response the client actually received, which the app already
    produced correctly before that re-raise."""

    async def _boom(*args, **kwargs):
        raise RuntimeError("distinctive-marker-obs001-e2e: db_password=should-not-leak")

    monkeypatch.setattr(auth_service, "forgot_password", _boom)

    holder: dict = {}

    def _run():
        with TestClient(app, raise_server_exceptions=False) as c:
            holder["response"] = c.post(
                "/api/v1/auth/forgot-password",
                json={"email": "nobody@example.com"},
                headers={"X-Request-ID": "e2e-corr-id-obs001"},
            )

    events = _capture_stdout_json_lines(_run)
    res = holder["response"]

    # --- client side: safe, generic, no leak ---
    assert res.status_code == 500
    body = res.json()
    assert body["success"] is False
    assert body["message"] == "An unexpected error occurred."
    raw_text = res.text
    assert "distinctive-marker-obs001-e2e" not in raw_text
    assert "db_password" not in raw_text
    assert "Traceback" not in raw_text
    assert "RuntimeError" not in raw_text
    assert res.headers.get("x-request-id") == "e2e-corr-id-obs001"

    # --- server side: real diagnostic content, correlated by request id ---
    error_events = [e for e in events if e.get("event") == "unhandled_error"]
    assert len(error_events) == 1
    error_event = error_events[0]
    assert error_event["request_id"] == "e2e-corr-id-obs001"
    assert "RuntimeError" in error_event["exception"]
    assert "distinctive-marker-obs001-e2e" in error_event["exception"]


def test_unhandled_exception_response_still_carries_baseline_security_headers(
    production_json_logging, monkeypatch
):
    """Adjacent regression found while building the OBS-001 request-ID
    fix: an unhandled exception's response is generated by Starlette's
    `ServerErrorMiddleware`, outside every `add_middleware(...)` layer —
    so, before this, it also silently skipped `SecurityHeadersMiddleware`
    entirely (every *other* response got X-Content-Type-Options etc.; a
    500 got none of them). `app/main.py` now applies the same baseline
    headers directly via `apply_baseline_security_headers`."""

    async def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(auth_service, "forgot_password", _boom)

    with TestClient(app, raise_server_exceptions=False) as c:
        res = c.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})

    assert res.status_code == 500
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("referrer-policy") == "no-referrer"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("cache-control") == "no-store"
