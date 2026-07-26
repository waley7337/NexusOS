"""Temporary internal diagnostic routes.

`GET /internal/proxy-diagnostics` is disabled by default and token-gated.
It exists solely to verify the live Railway proxy / forwarded-header path
during Part 3.2 — remove once that verification evidence is captured.
"""
import secrets

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.client_ip import resolve_client_identity
from app.core.config import settings
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/internal", tags=["Internal"])

_DIAGNOSTIC_TOKEN_HEADER = "X-Nexus-Diagnostic-Token"
_MAX_REFLECTED_HEADER_LEN = 4096
_NO_STORE = {"Cache-Control": "no-store"}


def _sanitize_reflected_header(value: str | None) -> str | None:
    """Bound and scrub a client-supplied header before reflecting it.

    Applied only to diagnostic *payload* fields that echo request headers.
    Never used on the diagnostic token (which is never returned).
    """
    if value is None:
        return None
    cleaned = value.replace("\r", "").replace("\n", "").replace("\x00", "")
    if len(cleaned) > _MAX_REFLECTED_HEADER_LEN:
        cleaned = cleaned[:_MAX_REFLECTED_HEADER_LEN]
    return cleaned


def _not_found() -> JSONResponse:
    """Indistinguishable generic 404 with explicit no-store."""
    return JSONResponse(
        status_code=404,
        content={"detail": "Not Found"},
        headers=_NO_STORE,
    )


def _proxy_diagnostics_authorized(request: Request) -> bool:
    """Return True only when the endpoint is explicitly enabled, a non-empty
    token is configured, and the request presents that exact token.

    Failures (disabled / unconfigured / missing / wrong) are intentionally
    indistinguishable — every denial is HTTP 404 at the call site. The
    configured token is never logged or returned.
    """
    if not settings.PROXY_DIAGNOSTICS_ENABLED:
        return False

    configured = settings.PROXY_DIAGNOSTICS_TOKEN
    if configured is None:
        return False

    expected = configured.get_secret_value()
    if not expected:
        return False

    provided = request.headers.get(_DIAGNOSTIC_TOKEN_HEADER)
    if provided is None:
        return False

    return secrets.compare_digest(provided, expected)


@router.get(
    "/proxy-diagnostics",
    summary="Temporary proxy-path diagnostics",
    include_in_schema=False,
)
async def proxy_diagnostics(request: Request) -> JSONResponse:
    if not _proxy_diagnostics_authorized(request):
        return _not_found()

    identity = resolve_client_identity(request)
    peer_ip = request.client.host if request.client else None

    data = {
        "peerIp": peer_ip,
        "xRealIp": _sanitize_reflected_header(request.headers.get("x-real-ip")),
        "xForwardedFor": _sanitize_reflected_header(
            request.headers.get("x-forwarded-for")
        ),
        "xForwardedProto": _sanitize_reflected_header(
            request.headers.get("x-forwarded-proto")
        ),
        "xForwardedHost": _sanitize_reflected_header(
            request.headers.get("x-forwarded-host")
        ),
        "resolvedIp": identity.resolved_ip,
        "resolvedScheme": identity.scheme,
        "viaTrustedProxy": identity.via_trusted_proxy,
    }

    body = ApiResponse.ok(data=data).model_dump()
    return JSONResponse(content=body, headers=_NO_STORE)
