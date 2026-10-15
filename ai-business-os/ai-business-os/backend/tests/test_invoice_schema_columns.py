"""Regression: invoices.sent_at / voided_at must exist after finance migrations.

Root cause (local/dev, 2026-10-15): alembic_version stamped to orphan revision
`036eaa06e6d8` (not in the repo) blocked `alembic upgrade`, so migration
`d1e2f3a4b5c6` never applied. Invoice ORM queries then failed with
`UndefinedColumn: column invoices.sent_at does not exist`.

Healthy environments are at head `c6d7e8f9a0b1` with both columns present.
"""
from __future__ import annotations

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

REQUIRED_INVOICE_COLUMNS = frozenset({"sent_at", "voided_at"})


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_invoices_table_has_sent_at_and_voided_at(db):
    rows = (
        await db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'invoices'
                  AND column_name = ANY(:cols)
                """
            ),
            {"cols": list(REQUIRED_INVOICE_COLUMNS)},
        )
    ).scalars().all()
    present = set(rows)
    missing = REQUIRED_INVOICE_COLUMNS - present
    assert not missing, (
        f"invoices missing {sorted(missing)}; apply Alembic through "
        f"d1e2f3a4b5c6 (head c6d7e8f9a0b1). Orphan alembic_version stamps "
        f"block upgrades and reproduce list/detail 500s."
    )


@pytest.mark.asyncio
async def test_invoice_orm_select_includes_sent_at(db):
    """ORM SELECT must not raise UndefinedColumn against the live schema."""
    await db.execute(text("SELECT id, sent_at, voided_at FROM invoices LIMIT 1"))
