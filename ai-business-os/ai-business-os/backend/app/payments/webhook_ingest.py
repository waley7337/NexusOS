"""Shared webhook receipt + dedupe for Stripe events."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PaymentProviderKind, WebhookDomain, WebhookProcessingStatus
from app.models.payments import ProviderWebhookEvent
from app.payments.providers.base import ProviderWebhookEvent as ProviderWebhookEnvelope
from app.utils.uuid7 import uuid7


async def claim_webhook_event(
    db: AsyncSession,
    *,
    domain: WebhookDomain,
    envelope: ProviderWebhookEnvelope,
    company_id: uuid.UUID | None = None,
) -> tuple[ProviderWebhookEvent, bool]:
    """Insert-or-read webhook receipt. Returns (row, is_new)."""
    now = datetime.now(UTC)
    values = {
        "id": uuid7(),
        "provider": PaymentProviderKind.STRIPE,
        "domain": domain,
        "external_event_id": envelope.external_event_id,
        "event_type": envelope.event_type,
        "provider_account_ref": envelope.provider_account_ref,
        "company_id": company_id,
        "processing_status": WebhookProcessingStatus.RECEIVED,
        "received_at": now,
        "processed_at": None,
        "failure_reason": None,
        "payload_hash": envelope.payload_hash,
    }
    stmt = (
        insert(ProviderWebhookEvent)
        .values(**values)
        .on_conflict_do_nothing(
            index_elements=["provider", "external_event_id"],
        )
        .returning(ProviderWebhookEvent)
    )
    claimed = (await db.execute(stmt)).scalar_one_or_none()
    if claimed is not None:
        await db.flush()
        return claimed, True

    existing = (
        await db.execute(
            select(ProviderWebhookEvent).where(
                ProviderWebhookEvent.provider == PaymentProviderKind.STRIPE,
                ProviderWebhookEvent.external_event_id == envelope.external_event_id,
            )
        )
    ).scalar_one()
    return existing, False


async def mark_webhook_processed(
    db: AsyncSession,
    row: ProviderWebhookEvent,
    *,
    status: WebhookProcessingStatus,
    failure_reason: str | None = None,
    company_id: uuid.UUID | None = None,
) -> None:
    row.processing_status = status
    row.processed_at = datetime.now(UTC)
    row.failure_reason = failure_reason[:500] if failure_reason else None
    if company_id is not None:
        row.company_id = company_id
    await db.flush()


def event_object(event: dict[str, Any]) -> dict[str, Any]:
    data = event.get("data") or {}
    obj = data.get("object") or {}
    return obj if isinstance(obj, dict) else {}
