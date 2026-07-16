"""Centralized sensitive-data redaction.

Used two ways:
  1. As a structlog processor (`redaction_processor`) — every log event's
     key/value pairs are scrubbed before they reach the renderer, so a
     careless `logger.info("x", **payload.model_dump())` can't leak a
     password or token even by accident. Registered in `app/core/logging.py`.
  2. As a direct helper (`redact()`) — for audit-log `old_values`/
     `new_values` snapshots and anything else a caller wants to sanitize
     before persisting or serializing it. See `app/services/audit_service.py`.

This is defense in depth, not the primary control: callers must still avoid
logging/persisting secrets directly (see `app/services/auth_service.py`,
which never passes a raw password/token to `structlog` at all). Treat this
module as the safety net that catches the *next* mistake, not a license to
be careless about the first one.
"""
from typing import Any

# Case-insensitive substring match against dict keys. Deliberately broad:
# a false positive (redacting a harmless field whose name happens to
# contain "token") is a minor UX inconvenience in a log line; a false
# negative (failing to redact a real secret) is a security incident.
SENSITIVE_KEY_MARKERS: tuple[str, ...] = (
    "password", "passwd", "secret", "token", "authorization", "auth_header",
    "api_key", "apikey", "access_key", "private_key", "credential",
    "cookie", "session_id", "jti", "otp", "pin_code", "ssn", "card_number", "cvv",
)

REDACTED = "***REDACTED***"

# Recursion into nested dict/list structures is bounded — this only ever
# processes app-controlled log kwargs / audit snapshots, never arbitrary
# untrusted payloads, but a bound costs nothing and forecloses surprises.
_MAX_DEPTH = 8


def _is_sensitive_key(key: str) -> bool:
    lowered = key.lower()
    return any(marker in lowered for marker in SENSITIVE_KEY_MARKERS)


def redact(value: Any, *, _depth: int = 0) -> Any:
    """Recursively scrub sensitive-looking dict keys. Non-dict/list values
    pass through unchanged; a whole sub-tree rooted at a sensitive key is
    collapsed to `REDACTED` rather than recursed into (if the key itself
    says "password", nothing under it is worth preserving)."""
    if _depth > _MAX_DEPTH:
        return "***TRUNCATED***"
    if isinstance(value, dict):
        return {
            k: (REDACTED if _is_sensitive_key(str(k)) else redact(v, _depth=_depth + 1))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(v, _depth=_depth + 1) for v in value]
    return value


def redaction_processor(logger: Any, method_name: str, event_dict: dict) -> dict:
    """structlog processor: scrubs every key/value pair in the event dict.
    A key that itself looks sensitive is fully redacted (its value is never
    inspected, even if it's a nested structure); every other value is
    recursively scrubbed in case it *contains* sensitive keys."""
    for key in list(event_dict.keys()):
        if _is_sensitive_key(str(key)):
            event_dict[key] = REDACTED
        else:
            event_dict[key] = redact(event_dict[key])
    return event_dict
