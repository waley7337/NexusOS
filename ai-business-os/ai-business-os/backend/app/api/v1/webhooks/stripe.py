"""Stripe webhook endpoints — raw body + signature verification."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Header, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ServiceUnavailableError
from app.db.session import AsyncSessionLocal
from app.payments.platform.webhook_handlers import process_platform_stripe_event
from app.payments.providers.stripe.webhook_verify import (
    WebhookVerificationError,
    verify_stripe_webhook_event,
)
from app.payments.stripe_config import (
    require_connect_webhook_secret,
    require_platform_webhook_secret,
)
from app.payments.tenant.webhook_handlers import process_tenant_stripe_event

logger = structlog.get_logger("api.webhooks.stripe")

router = APIRouter(prefix="/webhooks/stripe", tags=["Webhooks"])


async def _handle(
    *,
    request: Request,
    signature: str | None,
    secret: str,
    domain: str,
) -> Response:
    payload = await request.body()
    try:
        verified = verify_stripe_webhook_event(
            payload=payload,
            signature_header=signature,
            webhook_secret=secret,
        )
    except WebhookVerificationError:
        logger.warning("stripe_webhook_invalid_signature", domain=domain)
        return Response(status_code=status.HTTP_400_BAD_REQUEST)

    async with AsyncSessionLocal() as db:
        try:
            if domain == "platform":
                await process_platform_stripe_event(
                    db, envelope=verified.envelope, event=verified.event
                )
            else:
                await process_tenant_stripe_event(
                    db, envelope=verified.envelope, event=verified.event
                )
            await db.commit()
        except Exception:
            await db.rollback()
            # Return 500 so Stripe retries; receipt row may be FAILED.
            logger.exception(
                "stripe_webhook_processing_error",
                domain=domain,
                event_id=verified.envelope.external_event_id,
                event_type=verified.envelope.event_type,
            )
            return Response(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(status_code=status.HTTP_200_OK)


@router.post("/platform")
async def stripe_platform_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> Response:
    try:
        secret = require_platform_webhook_secret()
    except ServiceUnavailableError:
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return await _handle(
        request=request,
        signature=stripe_signature,
        secret=secret,
        domain="platform",
    )


@router.post("/connect")
async def stripe_connect_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> Response:
    """Connect + tenant Checkout events (connected-account context)."""
    try:
        secret = require_connect_webhook_secret()
    except ServiceUnavailableError:
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
    return await _handle(
        request=request,
        signature=stripe_signature,
        secret=secret,
        domain="connect",
    )
