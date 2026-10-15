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
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.finance import Invoice

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
EXPECTED_ALEMBIC_HEAD = "c6d7e8f9a0b1"
REQUIRED_INVOICE_COLUMNS = frozenset({"sent_at", "voided_at"})

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_alembic_version_is_finance_head(db):
    """Orphan stamps outside the repo graph block upgrades and skip sent_at."""
    version = (
        await db.execute(text("SELECT version_num FROM alembic_version"))
    ).scalar_one()
    assert version == EXPECTED_ALEMBIC_HEAD, (
        f"alembic_version={version!r}; expected {EXPECTED_ALEMBIC_HEAD}. "
        f"Orphan stamps (e.g. 036eaa06e6d8) block upgrade past d1e2f3a4b5c6."
    )


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
        f"d1e2f3a4b5c6 (head {EXPECTED_ALEMBIC_HEAD}). Orphan alembic_version "
        f"stamps block upgrades and reproduce list/detail 500s."
    )


@pytest.mark.asyncio
async def test_invoice_orm_select_includes_sent_at(db):
    """ORM SELECT must not raise UndefinedColumn against the live schema."""
    await db.execute(text("SELECT id, sent_at, voided_at FROM invoices LIMIT 1"))


@pytest.mark.asyncio
async def test_invoice_orm_mapped_query_matches_list_endpoint(db):
    """Same mapped columns the invoices list/detail handlers load via ORM."""
    result = await db.execute(select(Invoice).limit(1))
    invoice = result.scalar_one_or_none()
    if invoice is not None:
        # Attribute access forces column materialization used by serializers.
        assert hasattr(invoice, "sent_at")
        assert hasattr(invoice, "voided_at")
        _ = invoice.sent_at, invoice.voided_at


def test_invoice_list_endpoint_ok_with_current_schema():
    """HTTP list must not 500 from UndefinedColumn on invoices.sent_at."""
    from fastapi.testclient import TestClient

    from app.main import app

    tag = os.urandom(3).hex()
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "companyName": f"Schema Co {tag}",
                "firstName": "Schema",
                "lastName": "Guard",
                "email": f"schema-{tag}@invoiceschema.example.com",
                "password": "InvoiceSchema1234",
            },
        )
        assert register.status_code == 201, register.text
        token = register.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        listed = client.get("/api/v1/finance/invoices", headers=headers)
        assert listed.status_code == 200, listed.text
        body = listed.json()
        assert body["success"] is True
        assert "items" in body["data"]
