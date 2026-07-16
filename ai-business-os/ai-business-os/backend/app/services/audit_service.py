"""Append-only audit logging (§24).

This module only ever `INSERT`s. Nothing here issues an `UPDATE` or
`DELETE` against `audit_logs` — the model has no soft-delete columns and no
repository sits in front of it (a repository's `update`/`soft_delete` would
be the wrong tool for an immutable trail anyway).

`old_values`/`new_values` are always passed through `redact()` before
persisting. Callers must pass a small, explicit dict of the fields that
matter for the audit trail — never `vars(model)` or `model.__dict__` — so a
future sensitive column (e.g. a new token/secret field) can't silently end
up in a permanent, queryable history table just because it happened to
exist on the ORM object at the time.

`record()` only flushes, never commits: an audit event must live inside the
same business transaction as the action it describes, so a rolled-back
operation never leaves an orphaned audit record behind (§16 transaction
boundaries, §24 audit-log security).
"""
import ipaddress
import uuid
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redaction import redact
from app.models import AuditLog

logger = structlog.get_logger("app.audit")

# Defends against a pathological/misbehaving caller stuffing an oversized
# header into the audit trail forever — INET/columns are already bounded by
# the DB, but user_agent is a plain VARCHAR(400); truncate defensively here
# too so callers never need to remember the column limit.
_MAX_USER_AGENT_LEN = 400


def _safe_ip(value: str | None) -> str | None:
    """`AuditLog.ip_address` is a real Postgres `INET` column — passing it
    anything that isn't a well-formed IP (a proxy misconfiguration, a test
    client's synthetic hostname, IPv6 with a zone id, etc.) would fail the
    whole insert with a `DataError`, which is exactly the wrong failure mode
    for an audit write: losing the audit record is worse than losing the IP.
    Silently drop anything that doesn't parse rather than raising."""
    if not value:
        return None
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return None
    return value


async def record(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    action: str,
    entity: str,
    entity_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """Write one audit event.

    `company_id` is required and always trusted-context-derived by the
    caller (never taken from client input) — an audit log with no tenant
    would be both a schema violation (`AuditLog` is `TenantMixin`) and a
    meaningless record nobody could ever legitimately query.
    """
    entry = AuditLog(
        company_id=company_id,
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        old_values=redact(old_values) if old_values else None,
        new_values=redact(new_values) if new_values else None,
        ip_address=_safe_ip(ip_address),
        user_agent=user_agent[:_MAX_USER_AGENT_LEN] if user_agent else None,
    )
    db.add(entry)
    await db.flush()
    logger.info(
        "audit.recorded",
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id else None,
        company_id=str(company_id),
    )
    return entry
