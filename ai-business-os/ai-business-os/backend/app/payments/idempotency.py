"""Tenant-scoped idempotency record helpers (foundation)."""
from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payments import IdempotencyRecord

DEFAULT_TTL_HOURS = 24


def hash_request_payload(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


async def find_idempotency_record(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    scope: str,
    idempotency_key: str,
) -> IdempotencyRecord | None:
    stmt = select(IdempotencyRecord).where(
        IdempotencyRecord.company_id == company_id,
        IdempotencyRecord.scope == scope,
        IdempotencyRecord.idempotency_key == idempotency_key,
        IdempotencyRecord.expires_at > datetime.now(UTC),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def store_idempotency_record(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    scope: str,
    idempotency_key: str,
    request_hash: str | None,
    result_entity_type: str | None,
    result_entity_id: uuid.UUID | None,
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> IdempotencyRecord:
    record = IdempotencyRecord(
        company_id=company_id,
        scope=scope,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        result_entity_type=result_entity_type,
        result_entity_id=result_entity_id,
        expires_at=datetime.now(UTC) + timedelta(hours=ttl_hours),
    )
    db.add(record)
    await db.flush()
    return record
