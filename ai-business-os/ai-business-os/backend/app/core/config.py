"""Application configuration.

All configuration is environment-driven (12-factor). Nothing here is
hard-coded per environment; the same image runs in dev, staging, and prod.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # --- Database ---
    DATABASE_URL: PostgresDsn
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

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
