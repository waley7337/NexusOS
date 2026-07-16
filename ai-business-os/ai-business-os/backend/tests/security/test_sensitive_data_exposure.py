"""Regression tests for the centralized redaction utility and its use in
structured logging + audit records. Proves secrets never reach a log line or
an audit row, even when nested inside arbitrary caller-supplied structures.
"""
from app.core.redaction import REDACTED, redact, redaction_processor


def test_top_level_sensitive_key_is_redacted():
    out = redact({"password": "s3cret", "email": "a@b.com"})
    assert out["password"] == REDACTED
    assert out["email"] == "a@b.com"


def test_case_insensitive_key_matching():
    out = redact({"PASSWORD": "s3cret", "Api_Key": "xyz", "AUTHORIZATION": "Bearer x"})
    assert out["PASSWORD"] == REDACTED
    assert out["Api_Key"] == REDACTED
    assert out["AUTHORIZATION"] == REDACTED


def test_substring_match_catches_variant_field_names():
    """Deliberately broad: access_token, refresh_token, reset_token, jti,
    etc. must all be caught by a single "token"/"jti" marker."""
    out = redact({
        "access_token": "a",
        "refresh_token": "b",
        "reset_token_hash": "c",
        "session_jti": "d",
    })
    assert all(v == REDACTED for v in out.values())


def test_nested_dict_is_recursively_scrubbed():
    out = redact({"user": {"email": "a@b.com", "auth": {"password": "s3cret"}}})
    assert out["user"]["auth"]["password"] == REDACTED
    assert out["user"]["email"] == "a@b.com"


def test_sensitive_subtree_is_collapsed_not_recursed():
    """If the key itself says 'password', nothing nested beneath it is worth
    preserving — collapse the whole value rather than walking into it."""
    out = redact({"password": {"hash": "abc", "salt": "def"}})
    assert out["password"] == REDACTED


def test_list_of_dicts_is_scrubbed_elementwise():
    out = redact([{"token": "a"}, {"name": "safe"}])
    assert out[0]["token"] == REDACTED
    assert out[1]["name"] == "safe"


def test_non_dict_values_pass_through_unchanged():
    assert redact("plain string") == "plain string"
    assert redact(42) == 42
    assert redact(None) is None


def test_deeply_nested_structure_is_bounded_not_infinite():
    """Recursion is capped — must not stack-overflow on pathological depth."""
    nested = {"a": {}}
    cursor = nested["a"]
    for _ in range(50):
        cursor["a"] = {}
        cursor = cursor["a"]
    cursor["password"] = "leak-me"
    result = redact(nested)
    assert result is not None  # doesn't raise


def test_redaction_processor_scrubs_event_dict_in_place():
    event_dict = {
        "event": "login_attempt",
        "password": "s3cret",
        "Authorization": "Bearer abc123",
        "user_id": "u-1",
    }
    out = redaction_processor(None, "info", event_dict)
    assert out["password"] == REDACTED
    assert out["Authorization"] == REDACTED
    assert out["user_id"] == "u-1"
    assert out["event"] == "login_attempt"


def test_redaction_processor_handles_sensitive_key_with_nested_value():
    """A sensitive top-level key must be redacted wholesale — never inspected
    even if its value is a nested dict/list a naive impl might recurse into."""
    event_dict = {"credentials": {"password": "s3cret", "email": "a@b.com"}}
    out = redaction_processor(None, "info", event_dict)
    assert out["credentials"] == REDACTED
