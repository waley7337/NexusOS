"""Regression tests for X-Request-ID sanitization.

A client-supplied X-Request-ID flows unmodified into every log line, the
response header, and (via audit metadata) into audit records. It must never
be trusted verbatim: control characters enable log injection/forging, and an
unbounded string enables a cheap memory/log-volume abuse vector.
"""
from app.middleware.request_context import _sanitize_request_id


def test_valid_request_id_is_preserved():
    assert _sanitize_request_id("abc-123.def_456") == "abc-123.def_456"


def test_missing_request_id_generates_a_fresh_one():
    generated = _sanitize_request_id(None)
    assert generated  # non-empty
    assert _sanitize_request_id(None) != generated, "must not reuse a fixed fallback"


def test_empty_request_id_generates_a_fresh_one():
    assert _sanitize_request_id("") != ""


def test_oversized_request_id_is_rejected():
    oversized = "a" * 500
    sanitized = _sanitize_request_id(oversized)
    assert sanitized != oversized
    assert len(sanitized) < 500


def test_control_characters_are_rejected():
    """CRLF injection: a naive implementation would let this forge extra log
    lines or HTTP response header injection."""
    malicious = "legit-id\r\nX-Injected: evil"
    sanitized = _sanitize_request_id(malicious)
    assert sanitized != malicious
    assert "\r" not in sanitized and "\n" not in sanitized


def test_newline_only_payload_is_rejected():
    assert "\n" not in _sanitize_request_id("\n\n\n")


def test_whitespace_is_rejected():
    assert _sanitize_request_id("has space") != "has space"


def test_sql_like_payload_is_rejected_as_plain_data():
    """Not a SQL sink, but proves arbitrary attacker strings never pass
    through unsanitized regardless of what they look like."""
    payload = "'; DROP TABLE users; --"
    sanitized = _sanitize_request_id(payload)
    assert sanitized != payload
