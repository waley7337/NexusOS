"""Add the active invoice-payment chronology index for Payments HTTP reads.

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-08-19
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "b5c6d7e8f9a0"
down_revision: str | None = "a4b5c6d7e8f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

INDEX_NAME = "ix_payments_company_invoice_payment_date_id_active"


def upgrade() -> None:
    op.create_index(
        INDEX_NAME,
        "payments",
        ["company_id", "invoice_id", "payment_date", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL AND is_active = true"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="payments")
