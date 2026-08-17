"""Platform billing profile foundation — 1:1 Company SaaS subscription state.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-17
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_billing_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("stripe_customer_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("stripe_price_id", sa.String(length=255), nullable=True),
        sa.Column(
            "plan",
            sa.Enum("FREE", "STARTER", "PRO", "ENTERPRISE", name="platformplan", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "TRIALING", "ACTIVE", "PAST_DUE", "INCOMPLETE", "CANCELED", "PAUSED",
                name="platformsubscriptionstatus", native_enum=False, length=20,
            ),
            nullable=False,
        ),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_webhook_event_id", sa.String(length=255), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_platform_billing_profiles_company_id_companies"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_platform_billing_profiles")),
        sa.UniqueConstraint("company_id", name="uq_platform_billing_profiles_company_id"),
        sa.UniqueConstraint("stripe_customer_id", name="uq_platform_billing_profiles_stripe_customer"),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_platform_billing_profiles_stripe_subscription"),
    )


def downgrade() -> None:
    op.drop_table("platform_billing_profiles")
    sa.Enum(name="platformsubscriptionstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="platformplan").drop(op.get_bind(), checkfirst=True)
