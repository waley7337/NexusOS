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

from app.core.config import Settings  # noqa: E402


def _settings(database_url: str) -> Settings:
    return Settings(DATABASE_URL=database_url)  # type: ignore[call-arg,arg-type]


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
