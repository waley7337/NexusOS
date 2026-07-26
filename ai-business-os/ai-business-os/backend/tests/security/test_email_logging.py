"""Prove transactional email delivery never logs tokens or action links.

Also verifies action URLs are built from the centralized `FRONTEND_URL`
setting (never a hard-coded Vercel hostname in application code).
"""
import inspect
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

from app.core.config import settings  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.services import email_service as email_module  # noqa: E402
from app.services.email_service import (  # noqa: E402
    build_password_reset_link,
    build_verification_link,
    email_service,
)

# Distinctive fake secrets — must never appear in captured log output.
FAKE_VERIFICATION_TOKEN = "verif-token-MUST-NOT-APPEAR-in-logs-9f3c"
FAKE_RESET_TOKEN = "reset-token-MUST-NOT-APPEAR-in-logs-a1b2"
FAKE_RECIPIENT = "secret-recipient@example.test"


def _reset_logger_cache(logger: structlog.BoundLoggerLazyProxy) -> None:
    """Bust structlog's `cache_logger_on_first_use` for one module logger.

    Same isolation pattern as `test_exception_logging.py`: after the first
    use, BoundLoggerLazyProxy caches the pipeline; deleting the instance
    `.bind` forces re-read of the current global config.
    """
    if "bind" in vars(logger):
        del logger.bind


@pytest.fixture
def production_json_logging(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.is_production is True
    configure_logging()
    _reset_logger_cache(email_module.logger)
    yield
    monkeypatch.undo()
    configure_logging()
    _reset_logger_cache(email_module.logger)


def _capture_stdout_json_lines(fn) -> tuple[str, list[dict]]:
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        fn()
    finally:
        sys.stdout = real_stdout
    raw = buf.getvalue()
    parsed: list[dict] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return raw, parsed


def _assert_safe_delivery_log(raw: str, events: list[dict], *, delivery_type: str) -> dict:
    assert FAKE_VERIFICATION_TOKEN not in raw
    assert FAKE_RESET_TOKEN not in raw
    assert FAKE_RECIPIENT not in raw
    assert "verify-email?token=" not in raw
    assert "reset-password?token=" not in raw
    assert "/verify-email" not in raw
    assert "/reset-password" not in raw

    assert events, "safe delivery event must still be recorded"
    event = events[-1]
    assert event.get("event") == "email.delivery"
    assert event.get("delivery_type") == delivery_type
    assert event.get("delivery_status") == "accepted"
    assert "link" not in event
    assert "to" not in event
    assert "token" not in event
    return event


async def _capture_email_send(coro) -> tuple[str, list[dict]]:
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        await coro
    finally:
        sys.stdout = real_stdout
    raw = buf.getvalue()
    events: list[dict] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return raw, events


@pytest.mark.asyncio
async def test_verification_email_log_has_no_token_or_link(production_json_logging):
    raw, events = await _capture_email_send(
        email_service.send_verification_email(
            to=FAKE_RECIPIENT, token=FAKE_VERIFICATION_TOKEN
        )
    )
    _assert_safe_delivery_log(raw, events, delivery_type="email_verification")


@pytest.mark.asyncio
async def test_password_reset_email_log_has_no_token_or_link(production_json_logging):
    raw, events = await _capture_email_send(
        email_service.send_password_reset_email(
            to=FAKE_RECIPIENT, token=FAKE_RESET_TOKEN
        )
    )
    _assert_safe_delivery_log(raw, events, delivery_type="password_reset")


def test_generated_links_use_configured_frontend_url(monkeypatch):
    monkeypatch.setattr(
        settings, "FRONTEND_URL", "https://nexus-os-omega-two.vercel.app"
    )
    verification = build_verification_link(FAKE_VERIFICATION_TOKEN)
    reset = build_password_reset_link(FAKE_RESET_TOKEN)
    assert (
        verification
        == f"https://nexus-os-omega-two.vercel.app/verify-email?token={FAKE_VERIFICATION_TOKEN}"
    )
    assert (
        reset
        == f"https://nexus-os-omega-two.vercel.app/reset-password?token={FAKE_RESET_TOKEN}"
    )

    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        _ = build_verification_link(FAKE_VERIFICATION_TOKEN)
        _ = build_password_reset_link(FAKE_RESET_TOKEN)
    finally:
        sys.stdout = real_stdout
    assert buf.getvalue() == ""


def test_frontend_url_comes_from_centralized_settings():
    assert hasattr(settings, "FRONTEND_URL")
    source = inspect.getsource(email_module)
    assert "settings.FRONTEND_URL" in source
    assert "vercel.app" not in source


def test_auth_tokens_redacted_in_exception_logs(production_json_logging):
    """Authentication token kwargs must not survive the production pipeline."""

    def _do_logging():
        logger = structlog.get_logger("test.email_logging")
        try:
            raise RuntimeError("auth-path-boom")
        except RuntimeError:
            logger.exception(
                "unhandled_error",
                access_token=FAKE_VERIFICATION_TOKEN,
                refresh_token=FAKE_RESET_TOKEN,
                authorization=f"Bearer {FAKE_VERIFICATION_TOKEN}",
                link=build_verification_link(FAKE_VERIFICATION_TOKEN),
            )

    raw, events = _capture_stdout_json_lines(_do_logging)
    assert FAKE_VERIFICATION_TOKEN not in raw
    assert FAKE_RESET_TOKEN not in raw
    assert events
    event = events[0]
    assert event["access_token"] == "***REDACTED***"
    assert event["refresh_token"] == "***REDACTED***"
    assert event["authorization"] == "***REDACTED***"
    assert event["link"] == "***REDACTED***"


def test_no_test_module_prints_real_tokens():
    """Meta-guard: this test file must not print the fake tokens either."""
    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        _ = build_verification_link(FAKE_VERIFICATION_TOKEN)
        _ = build_password_reset_link(FAKE_RESET_TOKEN)
    finally:
        sys.stdout = real_stdout
    assert FAKE_VERIFICATION_TOKEN not in buf.getvalue()
    assert FAKE_RESET_TOKEN not in buf.getvalue()
