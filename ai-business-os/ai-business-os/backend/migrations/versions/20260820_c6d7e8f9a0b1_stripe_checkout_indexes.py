"""Stripe Checkout uniqueness and pending-provider guards.

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-08-20

Adds:
  * unique partial index on provider_checkout_session_id
  * at most one PENDING PROVIDER payment per invoice (active rows)
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c6d7e8f9a0b1"
down_revision: str | None = "b5c6d7e8f9a0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PENDING_INDEX = "ix_payments_company_invoice_pending_provider_uq"
CHECKOUT_INDEX = "ix_payments_provider_checkout_session_id_uq"


def upgrade() -> None:
    op.create_index(
        PENDING_INDEX,
        "payments",
        ["company_id", "invoice_id"],
        unique=True,
        postgresql_where=sa.text(
            "source = 'PROVIDER' AND status = 'PENDING' "
            "AND deleted_at IS NULL AND is_active = true"
        ),
    )
    op.create_index(
        CHECKOUT_INDEX,
        "payments",
        ["provider", "provider_checkout_session_id"],
        unique=True,
        postgresql_where=sa.text("provider_checkout_session_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(CHECKOUT_INDEX, table_name="payments")
    op.drop_index(PENDING_INDEX, table_name="payments")
