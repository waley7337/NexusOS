"""Application configuration.

All configuration is environment-driven (12-factor). Nothing here is
hard-coded per environment; the same image runs in dev, staging, and prod.
"""
import ipaddress
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that show up verbatim in .env.example / docs / CI fixtures. A real
# deployment must never end up running production with one of these —
# whether from a forgotten copy-paste or a container that silently fell
# back to a default. Kept lowercase; compared case-insensitively.
_KNOWN_INSECURE_SECRETS = frozenset(
    {
        "change-me-to-a-long-random-string-at-least-32-chars",
        "test-secret-key-must-be-32-chars-long!!",
        "ci-secret-key-must-be-32-chars-long!!!",
        "changeme" * 4,
        "secret" * 6,
        "0" * 32,
        "x" * 32,
    }
)


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

    # Explicit HSTS enablement for TLS-terminated deployments (e.g. Railway)
    # where the app sees plain HTTP from the edge and TRUSTED_PROXY_MODE=none
    # correctly ignores X-Forwarded-Proto. Default false so local/dev/test
    # never emit HSTS; enable only after confirming the public URL is HTTPS.
    HSTS_ENABLED: bool = False

    # Temporary Railway proxy-path diagnostic endpoint (disabled by default).
    # Never enable in production without a strong one-time token; remove after
    # Part 3.2 edge verification. See `app.api.v1.internal`.
    PROXY_DIAGNOSTICS_ENABLED: bool = False
    PROXY_DIAGNOSTICS_TOKEN: SecretStr | None = None

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
    REDIS_URL: RedisDsn = Field(default=RedisDsn("redis://localhost:6379/0"))

    # --- Rate limiting ---
    RATE_LIMIT_PER_MINUTE: int = 120
    # Disabled only in the test suite (every TestClient request shares the
    # same synthetic "testclient" host, so per-IP limiting would otherwise
    # trip across unrelated tests). The RateLimiter class itself is still
    # covered directly by dedicated unit tests regardless of this flag.
    RATE_LIMIT_ENABLED: bool = True

    # --- Trusted-proxy boundary (Part 3.1 remediation, SEC-001/SEC-003) ---
    # Centralized, explicit trust boundary consumed by `app.core.client_ip`.
    # Safe by default: "none" means *no* peer is ever trusted, regardless of
    # what `TRUSTED_PROXY_NETWORKS` holds — a client-supplied
    # X-Forwarded-For/X-Forwarded-Proto is always ignored and `request.
    # client.host` (the real TCP peer) is used as-is. This is intentionally
    # the out-of-the-box behavior: a deployment must *opt in* to proxy trust
    # by setting both this AND the CIDR list below, only after confirming
    # the exact edge/proxy IP ranges for that specific deployment (Railway's
    # published egress/proxy ranges, an internal load balancer's subnet,
    # etc.) — never "*", never guessed. Provider-neutral by design: adding
    # Cloudflare/Akamai later is just populating this list with their
    # published ranges, not a new code path.
    TRUSTED_PROXY_MODE: Literal["none", "static"] = "none"
    # CIDR strings (IPv4 and/or IPv6), e.g. ["10.0.0.0/8", "fd00::/8"].
    # Only consulted when TRUSTED_PROXY_MODE == "static".
    TRUSTED_PROXY_NETWORKS: list[str] = []

    @field_validator("TRUSTED_PROXY_NETWORKS")
    @classmethod
    def _validate_trusted_proxy_networks(cls, value: list[str]) -> list[str]:
        """Fail fast at startup on a malformed CIDR — this is operator-
        supplied trust-boundary configuration, not user input; a typo here
        must be loud, not silently ignored (see `client_ip.py`, which is
        deliberately defensive/silent only about *request* data, never about
        this config).

        Also rejects a CIDR covering an entire address family (prefix length
        0 — e.g. `0.0.0.0/0`, `::/0`, or an equivalent netmask-form spelling
        of either) — independent-re-review finding NEW-001. Checked on the
        *parsed* `ip_network` object, not the raw string, so an equivalent
        canonical form (any spelling `ipaddress` normalizes to prefixlen 0)
        is caught the same way. Unconditional — not just a production-only
        check — because this is never a legitimate trusted-proxy value in
        *any* environment: it would mean every possible IPv4/IPv6 peer in
        the world is a "trusted proxy" whose `X-Forwarded-For`/
        `X-Forwarded-Proto` gets honored, i.e. no trust boundary at all.
        `client_ip.py`'s right-to-left walk happens to stay spoof-resistant
        for *IP resolution* even under this misconfiguration (every hop
        looks "trusted", so the walk always falls back to the real peer —
        see `client_ip.py`'s module docstring), but the same misconfiguration
        fully reopens the forwarded-*scheme* trust decision (SEC-003) to any
        direct, untrusted caller. Rejecting it here closes that gap at the
        one place a typo/misconfiguration would otherwise take effect."""
        for entry in value:
            try:
                network = ipaddress.ip_network(entry, strict=False)
            except ValueError as exc:
                raise ValueError(
                    f"TRUSTED_PROXY_NETWORKS entry {entry!r} is not a valid IPv4/IPv6 "
                    "CIDR network (e.g. '10.0.0.0/8' or 'fd00::/8')."
                ) from exc
            if network.prefixlen == 0:
                family = "IPv4" if network.version == 4 else "IPv6"
                raise ValueError(
                    f"TRUSTED_PROXY_NETWORKS entry {entry!r} covers the entire "
                    f"{family} address space (prefix length /0). This is never a "
                    "legitimate trusted-proxy range — it would treat every "
                    "possible peer on the internet as a trusted proxy, destroying "
                    "the trusted-proxy boundary entirely (any direct client could "
                    "then influence forwarded-scheme trust, e.g. X-Forwarded-Proto, "
                    "even though it is not behind any real proxy). List the "
                    "deployment's actual, specific proxy/edge CIDR ranges instead "
                    "(e.g. '10.0.0.0/8', a load balancer's subnet, or a documented "
                    "provider egress range)."
                )
        return value

    # --- AI ---
    OPENAI_API_KEY: str | None = None

    # --- Email ---
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "no-reply@example.com"

    # --- Stripe (Part 08.1 foundation — optional until billing phases) ---
    STRIPE_PLATFORM_SECRET_KEY: SecretStr | None = None
    STRIPE_PLATFORM_PUBLISHABLE_KEY: str | None = None
    STRIPE_PLATFORM_WEBHOOK_SECRET: SecretStr | None = None
    STRIPE_CONNECT_WEBHOOK_SECRET: SecretStr | None = None
    STRIPE_API_VERSION: str | None = None
    PAYMENTS_IDEMPOTENCY_TTL_HOURS: int = 24

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


def validate_production_config(cfg: Settings) -> None:
    """Fail fast at startup if production configuration is insecure.

    Deliberately a no-op outside `ENVIRONMENT=production` — development and
    staging intentionally allow permissive defaults (http:// localhost CORS,
    a fixed test SECRET_KEY, DEBUG=true, …) for local ergonomics. Production
    gets zero benefit of the doubt: every violation below is something that
    would otherwise fail *silently* (a weak secret still "works", wildcard
    CORS still "works") until it's exploited.
    """
    if cfg.ENVIRONMENT != "production":
        return

    errors: list[str] = []

    if cfg.DEBUG:
        errors.append("DEBUG must be False in production (leaks stack traces/internals).")

    if cfg.SECRET_KEY.lower() in _KNOWN_INSECURE_SECRETS:
        errors.append(
            "SECRET_KEY is a known placeholder/test value — generate a unique "
            "secret (e.g. `python -c \"import secrets; print(secrets.token_urlsafe(48))\"`)."
        )

    if not cfg.CORS_ORIGINS:
        errors.append("CORS_ORIGINS must not be empty in production.")
    if "*" in cfg.CORS_ORIGINS:
        errors.append(
            "CORS_ORIGINS must not contain '*' in production — this app sends "
            "credentialed requests (allow_credentials=True), and a wildcard "
            "origin combined with credentials is a cross-tenant CSRF/data-leak risk."
        )
    insecure_origins = [
        origin for origin in cfg.CORS_ORIGINS
        if origin.startswith("http://") and "localhost" not in origin and "127.0.0.1" not in origin
    ]
    if insecure_origins:
        errors.append(
            f"CORS_ORIGINS must use https:// in production, found plaintext "
            f"origin(s): {insecure_origins!r}."
        )

    if cfg.TRUSTED_PROXY_MODE == "static" and not cfg.TRUSTED_PROXY_NETWORKS:
        errors.append(
            "TRUSTED_PROXY_MODE=static but TRUSTED_PROXY_NETWORKS is empty — this "
            "trusts nothing while claiming to trust something; either list the "
            "deployment's real proxy/edge CIDR ranges or set TRUSTED_PROXY_MODE=none."
        )

    if errors:
        formatted = "\n".join(f"  - {e}" for e in errors)
        raise RuntimeError(f"Refusing to start with insecure production configuration:\n{formatted}")


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance (safe to import anywhere)."""
    cfg = Settings()  # type: ignore[call-arg]
    validate_production_config(cfg)
    return cfg


settings = get_settings()
