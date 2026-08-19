"""Tenant-scoped idempotency record helpers (foundation)."""
from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.models.payments import IdempotencyRecord
from app.utils.uuid7 import uuid7

DEFAULT_TTL_HOURS = 24
ResultT = TypeVar("ResultT")


def hash_request_payload(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def hash_canonical_request(payload: dict[str, object]) -> str:
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hash_request_payload(encoded)


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


async def execute_idempotent(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    scope: str,
    idempotency_key: str,
    request_hash: str,
    operation: Callable[[], Awaitable[ResultT]],
    result_loader: Callable[[uuid.UUID], Awaitable[ResultT]],
    result_entity_type: str = "payment",
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> tuple[ResultT, bool]:
    """Atomically claim a financial command and return ``(result, replay)``.

    The unique insert is the coordination gate. A conflicting insert waits
    for the owning transaction; its next READ COMMITTED statement then sees
    either the committed result or, if the owner rolled back, can claim the
    key itself. Financial row locks are acquired only inside ``operation``.
    """
    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=ttl_hours)
    values = {
        "id": uuid7(),
        "company_id": company_id,
        "scope": scope,
        "idempotency_key": idempotency_key,
        "request_hash": request_hash,
        "result_entity_type": None,
        "result_entity_id": None,
        "expires_at": expires_at,
    }
    stmt = (
        insert(IdempotencyRecord)
        .values(**values)
        .on_conflict_do_nothing(
            index_elements=["company_id", "scope", "idempotency_key"]
        )
        .returning(IdempotencyRecord)
    )
    claimed = (await db.execute(stmt)).scalar_one_or_none()

    if claimed is None:
        existing = (
            await db.execute(
                select(IdempotencyRecord)
                .where(
                    IdempotencyRecord.company_id == company_id,
                    IdempotencyRecord.scope == scope,
                    IdempotencyRecord.idempotency_key == idempotency_key,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if existing is None:
            # A conflicting transaction can only disappear by rolling back;
            # retrying once lets this transaction become the owner.
            claimed = (await db.execute(stmt)).scalar_one_or_none()
            if claimed is None:
                raise ConflictError("Unable to acquire idempotency claim.")
        elif existing.expires_at <= now:
            existing.request_hash = request_hash
            existing.result_entity_type = None
            existing.result_entity_id = None
            existing.expires_at = expires_at
            claimed = existing
        else:
            if existing.request_hash != request_hash:
                raise ConflictError(
                    "Idempotency key was already used for another request.",
                    details={"reason": "idempotency_key_reused"},
                )
            if existing.result_entity_id is None:
                raise ConflictError(
                    "Idempotency record is incomplete.",
                    details={"reason": "idempotency_record_incomplete"},
                )
            return await result_loader(existing.result_entity_id), True

    result = await operation()
    result_id = getattr(result, "id", None)
    if not isinstance(result_id, uuid.UUID):
        raise RuntimeError("Idempotent operation did not return a persisted entity")
    claimed.result_entity_type = result_entity_type
    claimed.result_entity_id = result_id
    await db.flush()
    return result, False
