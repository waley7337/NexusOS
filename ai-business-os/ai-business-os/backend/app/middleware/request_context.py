"""Request context middleware.

* Assigns a request_id to every request (returned as X-Request-ID)
* Binds request_id to structlog contextvars so every log line is traceable
* Logs one structured access line per request with latency
"""
import re
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = structlog.get_logger("access")

# Client-supplied X-Request-ID flows unmodified into every log line, the
# response header, and (via audit_service callers) audit metadata. Trusting it
# verbatim would let a client inject control characters (log forging/log
# injection into whatever aggregator parses these lines) or an unbounded
# string (memory/log-volume abuse). Only accept a conservative, bounded,
# correlation-id-shaped value; anything else is replaced with a fresh
# server-generated id rather than rejecting the request outright.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def _sanitize_request_id(raw: str | None) -> str:
    if raw and _SAFE_REQUEST_ID.match(raw):
        return raw
    return str(uuid.uuid4())


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = _sanitize_request_id(request.headers.get("X-Request-ID"))
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )
        # Also on `request.state` (backed by the shared ASGI `scope`, not a
        # contextvar): `BaseHTTPMiddleware.__call__` runs the rest of the
        # chain in a *child* anyio task, so a bound contextvar here is
        # invisible to any ancestor task — which is exactly what
        # `ServerErrorMiddleware` (and the `unhandled_handler` it calls for
        # a bare `Exception`, in `app/main.py`) is. `request.state` has no
        # such boundary; see `unhandled_handler` for why this matters.
        request.state.request_id = request_id

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        logger.info("request", status=response.status_code, duration_ms=elapsed_ms)
        return response
