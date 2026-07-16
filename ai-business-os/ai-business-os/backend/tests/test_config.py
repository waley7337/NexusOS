"""Regression tests for DATABASE_URL driver normalization.

Railway (and most managed Postgres providers) hand out a driver-less
`postgresql://` URL. The app uses SQLAlchemy's async engine, which requires
an explicit `+asyncpg` driver — otherwise SQLAlchemy falls back to the sync
psycopg2 dialect and startup crashes with ModuleNotFoundError. See
`app.core.config._with_asyncpg_driver`.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")

import pytest  # noqa: E402

from app.core.config import Settings, validate_production_config  # noqa: E402


def _settings(database_url: str) -> Settings:
    return Settings(DATABASE_URL=database_url)  # type: ignore[call-arg,arg-type]


def _prod_settings(**overrides) -> Settings:
    base = dict(
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="a-perfectly-unique-production-secret-key-value-1234",
        DATABASE_URL="postgresql+asyncpg://prod:prod@db.internal:5432/prod",
        CORS_ORIGINS=["https://app.example.com"],
    )
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_bare_postgresql_scheme_gets_asyncpg_driver():
    settings = _settings("postgresql://user:pass@host:5432/db")
    assert str(settings.DATABASE_URL) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_bare_postgres_scheme_gets_asyncpg_driver():
    settings = _settings("postgres://user:pass@host:5432/db")
    assert str(settings.DATABASE_URL) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_asyncpg_scheme_is_left_unchanged():
    settings = _settings("postgresql+asyncpg://user:pass@host:5432/db")
    assert str(settings.DATABASE_URL) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_credentials_path_and_query_are_preserved():
    settings = _settings("postgresql://user:p%40ss@host:5432/railway?sslmode=require")
    url = str(settings.DATABASE_URL)
    assert url.startswith("postgresql+asyncpg://user:p%40ss@host:5432/railway")
    assert "sslmode=require" in url


def test_other_explicit_drivers_are_left_unchanged():
    settings = _settings("postgresql+psycopg://user:pass@host:5432/db")
    assert str(settings.DATABASE_URL) == "postgresql+psycopg://user:pass@host:5432/db"


# --------------------------------------------------------------------------- #
# validate_production_config — fail-fast startup checks (§25)
# --------------------------------------------------------------------------- #

def test_valid_production_config_passes():
    validate_production_config(_prod_settings())  # must not raise


def test_non_production_environment_is_never_validated():
    """Development/staging keep their permissive defaults — the whole point
    of this validator is that it only ever fires for ENVIRONMENT=production."""
    dev = _settings("postgresql+asyncpg://test:test@localhost:5432/test")
    validate_production_config(dev)  # must not raise, regardless of DEBUG/CORS


def test_debug_true_is_rejected_in_production():
    with pytest.raises(RuntimeError, match="DEBUG"):
        validate_production_config(_prod_settings(DEBUG=True))


def test_known_placeholder_secret_is_rejected_in_production():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_production_config(
            _prod_settings(SECRET_KEY="change-me-to-a-long-random-string-at-least-32-chars")
        )


def test_wildcard_cors_is_rejected_in_production():
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        validate_production_config(_prod_settings(CORS_ORIGINS=["*"]))


def test_empty_cors_is_rejected_in_production():
    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        validate_production_config(_prod_settings(CORS_ORIGINS=[]))


def test_plaintext_http_origin_is_rejected_in_production():
    with pytest.raises(RuntimeError, match="https"):
        validate_production_config(_prod_settings(CORS_ORIGINS=["http://app.example.com"]))


def test_localhost_http_origin_is_still_allowed_in_production():
    """Deliberately narrow escape hatch — an ops box hitting a prod API over
    an SSH tunnel on localhost is a normal operational pattern, not a
    security hole (it never touches the public network)."""
    validate_production_config(_prod_settings(CORS_ORIGINS=["http://localhost:8080"]))


def test_multiple_violations_are_all_reported_together():
    with pytest.raises(RuntimeError) as exc_info:
        validate_production_config(
            _prod_settings(DEBUG=True, CORS_ORIGINS=["*"])
        )
    message = str(exc_info.value)
    assert "DEBUG" in message
    assert "CORS_ORIGINS" in message
