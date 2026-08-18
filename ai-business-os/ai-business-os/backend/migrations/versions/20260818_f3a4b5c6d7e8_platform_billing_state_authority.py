"""PB.1 platform billing state authority and profile backfill.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-18
"""
from __future__ import annotations

from alembic import op

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PlatformSubscriptionStatus uses a non-native VARCHAR representation, so
    # NO_SUBSCRIPTION requires no database enum-type alteration. Reject legacy
    # FREE states whose intent cannot be preserved deterministically.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM companies c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM platform_billing_profiles p
                    WHERE p.company_id = c.id
                )
                  AND c.subscription_plan = 'FREE'
                  AND NOT (
                      c.subscription_status = 'TRIALING'
                      AND c.trial_ends_at IS NULL
                  )
            ) THEN
                RAISE EXCEPTION
                    'PB.1 backfill cannot safely infer billing state for a legacy FREE company with non-default status or trial';
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        INSERT INTO platform_billing_profiles (
            id,
            company_id,
            created_at,
            updated_at,
            stripe_customer_id,
            stripe_subscription_id,
            stripe_price_id,
            plan,
            status,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            canceled_at,
            trial_ends_at,
            last_webhook_event_id,
            last_synced_at
        )
        SELECT
            gen_random_uuid(),
            c.id,
            now(),
            now(),
            NULL,
            NULL,
            NULL,
            c.subscription_plan,
            CASE
                WHEN c.subscription_plan = 'FREE'
                    THEN 'NO_SUBSCRIPTION'
                ELSE c.subscription_status
            END,
            NULL,
            NULL,
            false,
            NULL,
            CASE
                WHEN c.subscription_plan = 'FREE' THEN NULL
                ELSE c.trial_ends_at
            END,
            NULL,
            NULL
        FROM companies c
        WHERE NOT EXISTS (
            SELECT 1
            FROM platform_billing_profiles p
            WHERE p.company_id = c.id
        );
        """
    )


def downgrade() -> None:
    # PB.1 cannot distinguish a backfilled profile from one provisioned by the
    # application after upgrade. Preserve every authoritative row and status;
    # only Alembic's revision marker moves backward. A code rollback must remain
    # compatible with the additive NO_SUBSCRIPTION value rather than fabricating
    # trial state or deleting billing authority data.
    pass
