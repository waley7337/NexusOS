"""Application entrypoint.

App factory pattern: create_app() wires middleware, routers, and exception
handlers. Domain errors (AppError) are converted to the standard envelope
in exactly one place.
"""
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError, TenantIsolationError
from app.core.logging import configure_logging
from app.core.rate_limit import close_redis_client
from app.db.session import engine
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.security_headers import (
    SecurityHeadersMiddleware,
    apply_baseline_security_headers,
)

logger = structlog.get_logger("app")


if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        send_default_pii=False,
        traces_sample_rate=0.0,
        profiles_sample_rate=0.0,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("startup", app=settings.APP_NAME, env=settings.ENVIRONMENT)
    # Register AI providers (no-op when API key absent; logs warning).
    from app.services.ai_provider import setup_providers
    setup_providers()
    yield
    await engine.dispose()  # release pooled connections bound to this loop
    await close_redis_client()
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # Middleware registration.
    # Note: Starlette executes middleware in reverse registration order.
    # CORSMiddleware is added last so it runs first and can handle preflight requests.

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # --- Exception handlers → standard envelope ---
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        if isinstance(exc, TenantIsolationError):
            logger.critical("tenant_isolation_violation", details=exc.details)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "data": None,
                "message": exc.message,
                "errors": [{"code": exc.code, **(exc.details or {})}],
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": None,
                "message": "Invalid input.",
                "errors": [
                    {"code": "validation_error", "field": ".".join(map(str, e["loc"])), "detail": e["msg"]}
                    for e in exc.errors()
                ],
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Part 3.1 remediation (OBS-001, request-ID correlation): Starlette
        # treats a bare `Exception`/500 handler as belonging to
        # `ServerErrorMiddleware`, the one middleware layer *outside* every
        # `add_middleware(...)` call — so this code path runs outside
        # `RequestContextMiddleware` entirely. Concretely, that means two
        # things this handler cannot rely on the normal way every other
        # response does:
        #   1. structlog's contextvars (`request_id` bound by that
        #      middleware) are invisible here — `BaseHTTPMiddleware` runs
        #      the rest of the chain in a *child* anyio task per layer, and
        #      a contextvar set in a child task never propagates back to an
        #      ancestor task. Passed explicitly to `logger.exception(...)`
        #      below instead of relying on context merging.
        #   2. The response never passes back through
        #      `RequestContextMiddleware`'s own "stamp X-Request-ID on the
        #      way out" line, or through `SecurityHeadersMiddleware`, so
        #      both have to be applied here directly instead.
        # `request.state`, unlike a contextvar, is backed by the shared ASGI
        # `scope` dict and has no task-boundary problem — see
        # `RequestContextMiddleware.dispatch`, which sets it before calling
        # the rest of the chain.
        request_id = getattr(request.state, "request_id", None)
        logger.exception("unhandled_error", request_id=request_id)
        response = JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": "An unexpected error occurred.",
                "errors": [{"code": "internal_error"}],
            },
        )
        if request_id:
            response.headers["X-Request-ID"] = request_id
        apply_baseline_security_headers(response, request)
        return response

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
