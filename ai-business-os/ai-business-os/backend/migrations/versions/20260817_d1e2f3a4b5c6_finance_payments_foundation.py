"""Finance/payments foundation — provider accounts, payment extensions, webhooks.

Revision ID: d1e2f3a4b5c6
Revises: c4e8f1a2b3d6
Create Date: 2026-08-17

Schema:
  * payment_provider_accounts
  * provider_webhook_events
  * idempotency_records
  * payments provider architecture columns
  * invoices sent_at / voided_at
  * expenses paid_by composite tenant FK

Data (idempotent):
  * Insert payments/expenses/payment_providers permission catalog rows.
  * Backfill system role grants per app.db.seed.DEFAULT_ROLES (Part 08.1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d1e2f3a4b5c6"
down_revision = "c4e8f1a2b3d6"
branch_labels = None
depends_on = None

_MODULES: dict[str, list[str]] = {
    "customers": ["read", "create", "update", "delete"],
    "contacts": ["read", "create", "update", "delete"],
    "leads": ["read", "create", "update", "delete"],
    "deals": ["read", "create", "update", "delete"],
    "projects": ["read", "create", "update", "delete", "manage"],
    "tasks": ["read", "create", "update", "delete"],
    "employees": [
        "read", "read_compensation", "read_self", "read_team",
        "create", "update", "delete",
    ],
    "finance": ["view", "manage"],
    "invoices": ["read", "create", "update", "delete", "send"],
    "payments": ["read", "create", "refund"],
    "expenses": ["read", "create", "update", "delete"],
    "payment_providers": ["read", "manage"],
    "inventory": ["read", "manage"],
    "documents": ["read", "upload", "delete"],
    "reports": ["view", "export", "schedule"],
    "workflows": ["read", "manage"],
    "ai": ["use"],
    "settings": ["view", "manage"],
    "users": ["read", "invite", "manage"],
    "roles": ["read", "manage"],
    "audit": ["view"],
}

_DEFAULT_ROLES: dict[str, str | list[str]] = {
    "Owner": "*",
    "Admin": "*",
    "Manager": [
        "customers.*", "contacts.*", "leads.*", "deals.*", "projects.*",
        "tasks.*", "invoices.read", "finance.view", "inventory.read",
        "documents.*", "reports.view", "reports.export", "ai.use", "users.read",
        "employees.read_team", "employees.read_self",
    ],
    "Employee": [
        "customers.read", "contacts.read", "leads.read", "projects.read",
        "tasks.*", "documents.read", "documents.upload", "ai.use",
        "employees.read_self",
    ],
    "Viewer": [
        "customers.read", "projects.read", "tasks.read", "reports.view",
    ],
}


def _all_permission_names() -> list[str]:
    return [f"{module}.{action}" for module, actions in _MODULES.items() for action in actions]


def _expand(patterns: str | list[str]) -> set[str]:
    catalog = _all_permission_names()
    if patterns == "*":
        return set(catalog)
    out: set[str] = set()
    for p in patterns:
        if p.endswith(".*"):
            prefix = p[:-1]
            out.update(name for name in catalog if name.startswith(prefix))
        else:
            out.add(p)
    return out


def upgrade() -> None:
    op.create_table(
        "payment_provider_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("STRIPE", name="paymentproviderkind", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("external_account_id", sa.String(length=255), nullable=False),
        sa.Column(
            "connection_status",
            sa.Enum(
                "PENDING", "ONBOARDING", "ACTIVE", "RESTRICTED", "DISCONNECTED",
                name="providerconnectionstatus", native_enum=False, length=20,
            ),
            nullable=False,
        ),
        sa.Column("charges_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("payouts_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disconnected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_payment_provider_accounts_company_id_companies"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payment_provider_accounts")),
        sa.UniqueConstraint("id", "company_id", name="uq_payment_provider_accounts_id_company"),
        sa.UniqueConstraint("provider", "external_account_id", name="uq_payment_provider_accounts_provider_external"),
    )
    op.create_index(op.f("ix_payment_provider_accounts_company_id"), "payment_provider_accounts", ["company_id"], unique=False)
    op.create_index(
        "ix_payment_provider_accounts_company_provider_active_uq",
        "payment_provider_accounts",
        ["company_id", "provider"],
        unique=True,
        postgresql_where=sa.text("disconnected_at IS NULL"),
    )

    op.add_column("invoices", sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("invoices", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("payments", sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False))
    op.add_column(
        "payments",
        sa.Column(
            "source",
            sa.Enum("MANUAL", "PROVIDER", name="paymentsource", native_enum=False, length=20),
            server_default="MANUAL",
            nullable=False,
        ),
    )
    op.add_column(
        "payments",
        sa.Column(
            "provider",
            sa.Enum("STRIPE", name="paymentproviderkind", native_enum=False, length=20),
            nullable=True,
        ),
    )
    op.add_column("payments", sa.Column("provider_account_id", sa.UUID(), nullable=True))
    op.add_column("payments", sa.Column("provider_payment_id", sa.String(length=255), nullable=True))
    op.add_column("payments", sa.Column("provider_checkout_session_id", sa.String(length=255), nullable=True))
    op.add_column("payments", sa.Column("idempotency_key", sa.String(length=255), nullable=True))
    op.add_column("payments", sa.Column("failure_code", sa.String(length=100), nullable=True))
    op.add_column("payments", sa.Column("failure_message", sa.String(length=500), nullable=True))
    op.add_column(
        "payments",
        sa.Column("refunded_amount", sa.Numeric(precision=14, scale=2), server_default="0", nullable=False),
    )
    op.add_column("payments", sa.Column("provider_refund_id", sa.String(length=255), nullable=True))
    op.add_column("payments", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("notes", sa.Text(), nullable=True))
    op.create_index(op.f("ix_payments_provider_account_id"), "payments", ["provider_account_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_payments_provider_account_id_payment_provider_accounts"),
        "payments",
        "payment_provider_accounts",
        ["provider_account_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_payments_provider_account_id_tenant_scoped",
        "payments",
        "payment_provider_accounts",
        ["provider_account_id", "company_id"],
        ["id", "company_id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_payments_provider_payment_id_uq",
        "payments",
        ["provider", "provider_payment_id"],
        unique=True,
        postgresql_where=sa.text("provider_payment_id IS NOT NULL"),
    )

    op.create_table(
        "provider_webhook_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("STRIPE", name="paymentproviderkind", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column(
            "domain",
            sa.Enum("PLATFORM_BILLING", "TENANT_PAYMENTS", name="webhookdomain", native_enum=False, length=30),
            nullable=False,
        ),
        sa.Column("external_event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("provider_account_ref", sa.String(length=255), nullable=True),
        sa.Column("company_id", sa.UUID(), nullable=True),
        sa.Column(
            "processing_status",
            sa.Enum("RECEIVED", "PROCESSED", "FAILED", "IGNORED", name="webhookprocessingstatus", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(length=500), nullable=True),
        sa.Column("payload_hash", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_provider_webhook_events_company_id_companies"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_webhook_events")),
        sa.UniqueConstraint("provider", "external_event_id", name="uq_provider_webhook_events_provider_event"),
    )
    op.create_index("ix_provider_webhook_events_company", "provider_webhook_events", ["company_id"], unique=False)
    op.create_index("ix_provider_webhook_events_status", "provider_webhook_events", ["processing_status"], unique=False)

    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("scope", sa.String(length=80), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=True),
        sa.Column("result_entity_type", sa.String(length=80), nullable=True),
        sa.Column("result_entity_id", sa.UUID(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_idempotency_records_company_id_companies"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_idempotency_records")),
        sa.UniqueConstraint("company_id", "scope", "idempotency_key", name="uq_idempotency_records_company_scope_key"),
    )
    op.create_index("ix_idempotency_records_expires_at", "idempotency_records", ["expires_at"], unique=False)
    op.create_index(op.f("ix_idempotency_records_company_id"), "idempotency_records", ["company_id"], unique=False)

    op.create_foreign_key(
        "fk_expenses_paid_by_tenant_scoped",
        "expenses",
        "users",
        ["paid_by", "company_id"],
        ["id", "company_id"],
        ondelete="SET NULL",
    )

    conn = op.get_bind()
    existing = {
        row[0]
        for row in conn.execute(sa.text("SELECT name FROM permissions")).fetchall()
    }
    for name in _all_permission_names():
        if name not in existing:
            conn.execute(
                sa.text(
                    "INSERT INTO permissions (id, name, description) "
                    "VALUES (gen_random_uuid(), :name, :description)"
                ),
                {
                    "name": name,
                    "description": f"Allows {name.replace('.', ' → ')}",
                },
            )

    roles = conn.execute(sa.text("SELECT id, name FROM roles WHERE is_system = true")).fetchall()
    perm_rows = conn.execute(sa.text("SELECT id, name FROM permissions")).fetchall()
    perm_by_name = {row.name: row.id for row in perm_rows}
    for role_id, role_name in roles:
        if role_name not in _DEFAULT_ROLES:
            continue
        for perm_name in _expand(_DEFAULT_ROLES[role_name]):
            perm_id = perm_by_name.get(perm_name)
            if perm_id is None:
                continue
            conn.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_id) "
                    "SELECT :role_id, :perm_id "
                    "WHERE NOT EXISTS ("
                    "  SELECT 1 FROM role_permissions "
                    "  WHERE role_id = :role_id AND permission_id = :perm_id"
                    ")"
                ),
                {"role_id": role_id, "perm_id": perm_id},
            )


def downgrade() -> None:
    op.drop_constraint("fk_expenses_paid_by_tenant_scoped", "expenses", type_="foreignkey")

    op.drop_index(op.f("ix_idempotency_records_company_id"), table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_expires_at", table_name="idempotency_records")
    op.drop_table("idempotency_records")

    op.drop_index("ix_provider_webhook_events_status", table_name="provider_webhook_events")
    op.drop_index("ix_provider_webhook_events_company", table_name="provider_webhook_events")
    op.drop_table("provider_webhook_events")

    op.drop_index("ix_payments_provider_payment_id_uq", table_name="payments")
    op.drop_constraint("fk_payments_provider_account_id_tenant_scoped", "payments", type_="foreignkey")
    op.drop_constraint(op.f("fk_payments_provider_account_id_payment_provider_accounts"), "payments", type_="foreignkey")
    op.drop_index(op.f("ix_payments_provider_account_id"), table_name="payments")
    op.drop_column("payments", "notes")
    op.drop_column("payments", "confirmed_at")
    op.drop_column("payments", "provider_refund_id")
    op.drop_column("payments", "refunded_amount")
    op.drop_column("payments", "failure_message")
    op.drop_column("payments", "failure_code")
    op.drop_column("payments", "idempotency_key")
    op.drop_column("payments", "provider_checkout_session_id")
    op.drop_column("payments", "provider_payment_id")
    op.drop_column("payments", "provider_account_id")
    op.drop_column("payments", "provider")
    op.drop_column("payments", "source")
    op.drop_column("payments", "currency")

    op.drop_column("invoices", "voided_at")
    op.drop_column("invoices", "sent_at")

    op.drop_index("ix_payment_provider_accounts_company_provider_active_uq", table_name="payment_provider_accounts")
    op.drop_index(op.f("ix_payment_provider_accounts_company_id"), table_name="payment_provider_accounts")
    op.drop_table("payment_provider_accounts")

    sa.Enum(name="webhookprocessingstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="webhookdomain").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="paymentsource").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="providerconnectionstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="paymentproviderkind").drop(op.get_bind(), checkfirst=True)
