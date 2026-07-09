"""Unit tests for the security core."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")

import pytest  # noqa: E402
import jwt as pyjwt  # noqa: E402

from app.core.security import (  # noqa: E402
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cure-password")
    assert hashed != "s3cure-password"
    assert verify_password("s3cure-password", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_carries_tenant_context():
    token = create_access_token("user-1", "company-1", "admin")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == "user-1"
    assert payload["company_id"] == "company-1"
    assert payload["role"] == "admin"


def test_refresh_token_rejected_as_access_token():
    token = create_refresh_token("user-1")
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_token(token, expected_type="access")
