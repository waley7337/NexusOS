"""Payment state and database authority for tenant Finance.

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-08-18

Operational remediation: if preflight fails, use its category, affected count,
and bounded stable-ID sample to locate the rows. Verify the real-world financial
history, explicitly correct it under an approved data-remediation procedure,
then rerun this migration. Never invent attribution/refunds or rewrite amounts,
and DO NOT use ``alembic stamp`` to bypass a failure.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a4b5c6d7e8f9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def _fail_on_invalid_existing_data() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            affected_count bigint;
            sample_ids text;
        BEGIN
            WITH affected AS (
                SELECT id FROM payments
                WHERE status IN ('COMPLETED', 'REFUNDED') AND confirmed_at IS NULL
            )
            SELECT count(*), (SELECT string_agg(id::text, ', ' ORDER BY id)
                              FROM (SELECT id FROM affected ORDER BY id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [missing_confirmation_authority]: count=%s sample_payment_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify historical confirmation evidence and explicitly remediate; do not invent actors or alembic stamp.';
            END IF;

            WITH affected AS (SELECT id FROM payments WHERE refunded_amount > 0)
            SELECT count(*), (SELECT string_agg(id::text, ', ' ORDER BY id)
                              FROM (SELECT id FROM affected ORDER BY id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [historical_refund_requires_attribution]: count=%s sample_payment_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify refund history and explicitly remediate attribution; do not invent refund history or alembic stamp.';
            END IF;

            WITH affected AS (
                SELECT id FROM payments p WHERE
                (p.source = 'MANUAL' AND (
                    p.provider IS NOT NULL OR p.provider_account_id IS NOT NULL
                    OR p.provider_payment_id IS NOT NULL OR p.provider_checkout_session_id IS NOT NULL
                    OR p.provider_refund_id IS NOT NULL))
                OR (p.source = 'PROVIDER' AND (p.provider IS NULL OR p.provider_account_id IS NULL))
            )
            SELECT count(*), (SELECT string_agg(id::text, ', ' ORDER BY id)
                              FROM (SELECT id FROM affected ORDER BY id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [manual_provider_identity_inconsistency]: count=%s sample_payment_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify the real payment source/provider ownership and explicitly correct it; do not alembic stamp.';
            END IF;

            WITH affected AS (
                SELECT p.id FROM payments p
                LEFT JOIN invoices i ON i.id = p.invoice_id
                WHERE i.id IS NULL OR p.company_id <> i.company_id OR p.currency <> i.currency
                   OR EXISTS (SELECT 1 FROM users u
                              WHERE u.id IN (p.created_by, p.updated_by) AND u.company_id <> p.company_id)
            )
            SELECT count(*), (SELECT string_agg(id::text, ', ' ORDER BY id)
                              FROM (SELECT id FROM affected ORDER BY id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [tenant_or_invoice_inconsistency]: count=%s sample_payment_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify tenant ownership and invoice currency before explicit remediation; do not alembic stamp.';
            END IF;

            WITH affected AS (
                SELECT p.company_id, p.invoice_id
                FROM payments p
                JOIN invoices i ON i.id = p.invoice_id AND i.company_id = p.company_id
                WHERE p.deleted_at IS NULL AND p.is_active
                  AND p.amount <> 'NaN'::numeric AND p.amount > 0
                  AND p.refunded_amount <> 'NaN'::numeric
                  AND p.refunded_amount >= 0 AND p.refunded_amount <= p.amount
                  AND p.status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')
                GROUP BY p.company_id, p.invoice_id, i.total
                HAVING sum(CASE
                    WHEN p.status = 'COMPLETED' THEN p.amount - p.refunded_amount
                    ELSE 0
                END) < 0
                OR sum(CASE
                    WHEN p.status = 'COMPLETED' THEN p.amount - p.refunded_amount
                    ELSE 0
                END) > i.total
            )
            SELECT count(*), (SELECT string_agg(invoice_id::text, ', ' ORDER BY invoice_id)
                              FROM (SELECT invoice_id FROM affected ORDER BY invoice_id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [aggregate_invoice_overpayment]: count=%s sample_invoice_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify the real payment/refund history and explicitly correct it; never cap balances, rewrite amounts, or alembic stamp.';
            END IF;

            WITH affected AS (
                SELECT id FROM payments p WHERE
                       p.amount = 'NaN'::numeric OR p.amount <= 0
                    OR p.refunded_amount = 'NaN'::numeric OR p.refunded_amount < 0
                    OR p.refunded_amount > p.amount
                    OR p.currency !~ '^[A-Z]{3}$'
                    OR p.status NOT IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')
                    OR p.source NOT IN ('MANUAL', 'PROVIDER')
                    OR (p.status = 'REFUNDED' AND p.refunded_amount <> p.amount)
                    OR (p.status IN ('PENDING', 'FAILED') AND p.confirmed_at IS NOT NULL)
                    OR (p.refunded_amount = 0 AND p.provider_refund_id IS NOT NULL)
                    OR ((p.failure_code IS NOT NULL OR p.failure_message IS NOT NULL) AND p.status <> 'FAILED')
                    OR p.deleted_at IS NOT NULL
            )
            SELECT count(*), (SELECT string_agg(id::text, ', ' ORDER BY id)
                              FROM (SELECT id FROM affected ORDER BY id LIMIT 5) sample)
            INTO affected_count, sample_ids
            FROM affected;
            IF affected_count > 0 THEN
                RAISE EXCEPTION USING
                    MESSAGE = format('08.4.1 preflight [invalid_financial_state]: count=%s sample_payment_ids=%s', affected_count, sample_ids),
                    HINT = 'Verify and explicitly correct the identified financial state; do not delete history, invent values, or alembic stamp.';
            END IF;
        END
        $$;
        """
    )


def upgrade() -> None:
    _fail_on_invalid_existing_data()

    op.add_column("payments", sa.Column("confirmed_by", sa.UUID(), nullable=True))
    op.add_column("payments", sa.Column("refunded_by", sa.UUID(), nullable=True))
    op.add_column("payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("refund_reason", sa.Text(), nullable=True))

    op.create_foreign_key("fk_payments_confirmed_by_users", "payments", "users", ["confirmed_by"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_payments_refunded_by_users", "payments", "users", ["refunded_by"], ["id"], ondelete="RESTRICT")
    for column in ("created_by", "updated_by", "confirmed_by", "refunded_by"):
        op.create_foreign_key(
            f"fk_payments_{column}_tenant_scoped", "payments", "users",
            [column, "company_id"], ["id", "company_id"], ondelete="RESTRICT",
        )

    op.create_check_constraint(
        "payment_amount_positive", "payments", "amount <> 'NaN'::numeric AND amount > 0"
    )
    op.create_check_constraint(
        "payment_refund_bounds", "payments",
        "refunded_amount <> 'NaN'::numeric AND refunded_amount >= 0 AND refunded_amount <= amount",
    )
    op.create_check_constraint("payment_currency_format", "payments", "currency ~ '^[A-Z]{3}$'")
    op.create_check_constraint("payment_refunded_is_full", "payments", "(status = 'REFUNDED' AND refunded_amount = amount) OR status <> 'REFUNDED'")
    op.create_check_constraint(
        "payment_confirmation_state", "payments",
        "(status IN ('COMPLETED', 'REFUNDED') AND confirmed_at IS NOT NULL) OR "
        "(status IN ('PENDING', 'FAILED') AND confirmed_at IS NULL)",
    )
    op.create_check_constraint(
        "payment_refund_metadata", "payments",
        "(refunded_amount = 0 AND refunded_at IS NULL AND refunded_by IS NULL AND refund_reason IS NULL AND provider_refund_id IS NULL) OR "
        "(refunded_amount > 0 AND refunded_at IS NOT NULL AND refund_reason IS NOT NULL AND btrim(refund_reason) <> '')",
    )
    op.create_check_constraint(
        "payment_source_provider_state", "payments",
        "(source = 'MANUAL' AND provider IS NULL AND provider_account_id IS NULL AND provider_payment_id IS NULL "
        "AND provider_checkout_session_id IS NULL AND provider_refund_id IS NULL) OR "
        "(source = 'PROVIDER' AND provider IS NOT NULL AND provider_account_id IS NOT NULL)",
    )
    op.create_check_constraint(
        "payment_failure_state", "payments",
        "(failure_code IS NULL AND failure_message IS NULL) OR status = 'FAILED'",
    )
    op.create_index("ix_payments_company_payment_date_id", "payments", ["company_id", "payment_date", "id"])


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM payments
                WHERE confirmed_by IS NOT NULL OR refunded_by IS NOT NULL
                   OR refunded_at IS NOT NULL OR refund_reason IS NOT NULL
            ) THEN
                RAISE EXCEPTION '08.4.1 downgrade refused: attribution/refund data would be lost';
            END IF;
        END
        $$;
        """
    )
    op.drop_index("ix_payments_company_payment_date_id", table_name="payments")
    for name in (
        "ck_payments_payment_failure_state",
        "ck_payments_payment_source_provider_state",
        "ck_payments_payment_refund_metadata",
        "ck_payments_payment_confirmation_state",
        "ck_payments_payment_refunded_is_full",
        "ck_payments_payment_currency_format",
        "ck_payments_payment_refund_bounds",
        "ck_payments_payment_amount_positive",
    ):
        op.drop_constraint(op.f(name), "payments", type_="check")
    for column in ("refunded_by", "confirmed_by", "updated_by", "created_by"):
        op.drop_constraint(f"fk_payments_{column}_tenant_scoped", "payments", type_="foreignkey")
    op.drop_constraint("fk_payments_refunded_by_users", "payments", type_="foreignkey")
    op.drop_constraint("fk_payments_confirmed_by_users", "payments", type_="foreignkey")
    op.drop_column("payments", "refund_reason")
    op.drop_column("payments", "refunded_at")
    op.drop_column("payments", "refunded_by")
    op.drop_column("payments", "confirmed_by")
