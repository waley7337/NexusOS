"""Structured logging with structlog.

Development: pretty console output.
Production: JSON lines, ready for any log aggregator.
Every log line automatically includes request_id / company_id / user_id
bound by the RequestContextMiddleware.

Part 3.1 remediation (OBS-001): `logger.exception(...)` (used by the
catch-all handler in `app/main.py`) sets `exc_info=True` in the event dict
— the standard-library-compatible signal "format the current exception".
`ConsoleRenderer` (dev) special-cases that key and pretty-prints the
traceback itself, which is why this gap was invisible locally. Structlog's
`JSONRenderer` (production) does *not* — it just serializes the event dict
as-is, so `exc_info: True` (a bare boolean) was emitted verbatim and the
actual exception type/message/traceback were silently discarded. Every
unhandled 500 in production was logging "yes, something broke" with zero
diagnostic content. `structlog.processors.format_exc_info` is the missing
step: it consumes `exc_info`, renders the real traceback text, and stores
it under an `exception` key *before* the renderer ever sees it — added
here only to the production chain since dev's own exception rendering
already works correctly and shouldn't be replaced.
"""
import logging
import sys

import structlog

from app.core.config import settings
from app.core.redaction import redaction_processor


def configure_logging() -> None:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        # Defense in depth (§23): scrub password/token/secret-looking keys
        # from every log line, in case a caller ever passes one by mistake.
        # Runs *before* exception formatting below: this still redacts every
        # normal structured field exactly as before; it does not scan free
        # text (including the rendered traceback) for embedded secrets —
        # that remains a documented limitation of key-based redaction, not
        # something this fix changes.
        redaction_processor,
    ]

    renderer_processors: list
    if settings.is_production:
        renderer_processors = [
            # Turns `exc_info=True`/an exc_info tuple into a real, readable
            # traceback string under the `exception` key — without this,
            # JSONRenderer has nothing exception-shaped to render.
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # ConsoleRenderer natively understands exc_info and pretty-prints
        # the traceback itself; running format_exc_info first would only
        # flatten that into a plain string field and lose the coloring.
        renderer_processors = [structlog.dev.ConsoleRenderer(colors=True)]

    structlog.configure(
        processors=[*shared_processors, *renderer_processors],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.DEBUG else logging.INFO
        ),
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
