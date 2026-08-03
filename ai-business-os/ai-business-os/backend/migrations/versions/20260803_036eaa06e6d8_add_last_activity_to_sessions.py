"""add last_activity to sessions

Revision ID: 036eaa06e6d8
Revises: 217e90d00cc0
Create Date: 2026-08-03 22:23:15.714533
"""

from alembic import op
import sqlalchemy as sa

revision = "036eaa06e6d8"
down_revision = "217e90d00cc0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "last_activity",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Remove the default after existing rows have been backfilled.
    op.alter_column(
        "sessions",
        "last_activity",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("sessions", "last_activity")