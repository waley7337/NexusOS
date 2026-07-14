"""Application configuration.

All configuration is environment-driven (12-factor). Nothing here is
hard-coded per environment; the same image runs in dev, staging, and prod.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _with_asyncpg_driver(value: object) -> object:
    """Managed Postgres providers (Railway, Heroku, etc.) hand out a
    driver-less `postgresql://`/`postgres://` URL. Left as-is, SQLAlchemy's
    async engine resolves the bare "postgresql" dialect to its default
    driver, psycopg2 (sync-only, not a project dependency), and startup
    crashes with ModuleNotFoundError. Rewrite only the scheme so the async
    engine loads asyncpg instead; URLs that already name a driver (e.g.
    `postgresql+asyncpg://`) pass through unchanged.
    """
    if not isinstance(value, str):
        return value
    scheme, sep, rest = value.partition("://")
    if sep and scheme.lower() in ("postgresql", "postgres"):
        return f"postgresql+asyncpg://{rest}"
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "AI Business OS"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # --- Security ---
    SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # --- Frontend ---
    # Base URL used to build user-facing links (email verification/reset).
    # Deliberately separate from CORS_ORIGINS: that list is security config
    # (which origins may call the API) and may hold multiple/ordered entries
    # for unrelated reasons — not a safe source for "the" app URL.
    FRONTEND_URL: str = "http://localhost:5173"

    # --- Observability ---
    SENTRY_DSN: str | None = None

    # --- Database ---
    DATABASE_URL: PostgresDsn
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    _normalize_database_url = field_validator("DATABASE_URL", mode="before")(
        _with_asyncpg_driver
    )

    # --- Redis ---
    REDIS_URL: RedisDsn = Field(default="redis://localhost:6379/0")

    # --- Rate limiting ---
    RATE_LIMIT_PER_MINUTE: int = 120

    # --- AI ---
    OPENAI_API_KEY: str | None = None

    # --- Email ---
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "no-reply@example.com"

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (safe to import anywhere)."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
