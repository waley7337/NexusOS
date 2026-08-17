"""HR employee foundation — identity fields, optional user link, SET NULL FKs.

Revision ID: c4e8f1a2b3d6
Revises: 8f4c2b91a0e7
Create Date: 2026-08-17

Schema:
  * Add employees.first_name, last_name, work_email for HR-only staff.
  * Backfill identity from linked users where present.
  * Make employees.user_id nullable.
  * Change User → Employee FK delete semantics from CASCADE to SET NULL
    (single-column + composite tenant FK) so employment history survives
    user hard-deletion.

Data (idempotent):
  * Insert employees.* permission catalog rows.
  * Backfill system role grants per app.db.seed.DEFAULT_ROLES (Part 07.1).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c4e8f1a2b3d6"
down_revision = "8f4c2b91a0e7"
branch_labels = None
depends_on = None

# Keep in sync with app.db.seed (Part 07.1 employees module).
_MODULES: dict[str, list[str]] = {
    "customers": ["read", "create", "update", "delete"],
    "contacts": ["read", "create", "update", "delete"],
    "leads": ["read", "create", "update", "delete"],
    "deals": ["read", "create", "update", "delete"],
    "projects": ["read", "create", "update", "delete", "manage"],
    "tasks": ["read", "create", "update", "delete"],
    "employees": [
        "read",
        "read_compensation",
        "read_self",
        "read_team",
        "create",
        "update",
        "delete",
    ],
    "finance": ["view", "manage"],
    "invoices": ["read", "create", "update", "delete", "send"],
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
    # --- Employee identity columns ---
    op.add_column("employees", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("employees", sa.Column("last_name", sa.String(length=100), nullable=True))
    op.add_column("employees", sa.Column("work_email", sa.String(length=255), nullable=True))

    # Backfill from linked users (safe when table is empty — no-op).
    op.execute(
        sa.text(
            """
            UPDATE employees e
            SET first_name = u.first_name,
                last_name = u.last_name,
                work_email = COALESCE(e.work_email, u.email)
            FROM users u
            WHERE e.user_id = u.id
              AND e.first_name IS NULL
            """
        )
    )

    # --- Optional user link + SET NULL delete semantics ---
    op.alter_column("employees", "user_id", existing_type=sa.UUID(), nullable=True)

    op.drop_constraint("fk_employees_user_id_tenant_scoped", "employees", type_="foreignkey")
    op.drop_constraint("fk_employees_user_id_users", "employees", type_="foreignkey")

    op.create_foreign_key(
        "fk_employees_user_id_users",
        "employees",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_employees_user_id_tenant_scoped",
        "employees",
        "users",
        ["user_id", "company_id"],
        ["id", "company_id"],
        ondelete="SET NULL",
    )

    # --- RBAC catalog + system role backfill ---
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

    perm_ids = {
        row[0]: row[1]
        for row in conn.execute(sa.text("SELECT name, id FROM permissions")).fetchall()
    }

    roles = conn.execute(
        sa.text(
            "SELECT id, name FROM roles "
            "WHERE is_system IS TRUE "
            "AND name IN ('Owner', 'Admin', 'Manager', 'Employee', 'Viewer')"
        )
    ).fetchall()

    for role_id, role_name in roles:
        want = _expand(_DEFAULT_ROLES[role_name])
        have = {
            row[0]
            for row in conn.execute(
                sa.text(
                    "SELECT p.name FROM role_permissions rp "
                    "JOIN permissions p ON p.id = rp.permission_id "
                    "WHERE rp.role_id = :role_id"
                ),
                {"role_id": role_id},
            ).fetchall()
        }
        for name in sorted(want - have):
            if name not in perm_ids:
                continue
            conn.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_id) "
                    "VALUES (:role_id, :permission_id) "
                    "ON CONFLICT DO NOTHING"
                ),
                {"role_id": role_id, "permission_id": perm_ids[name]},
            )


def downgrade() -> None:
    conn = op.get_bind()
    employee_count = conn.execute(sa.text("SELECT COUNT(*) FROM employees")).scalar_one()
    null_user_count = conn.execute(
        sa.text("SELECT COUNT(*) FROM employees WHERE user_id IS NULL")
    ).scalar_one()
    if employee_count and null_user_count:
        raise RuntimeError(
            "Cannot downgrade: employees with NULL user_id exist. "
            "Remove or relink HR-only rows first."
        )

    op.drop_constraint("fk_employees_user_id_tenant_scoped", "employees", type_="foreignkey")
    op.drop_constraint("fk_employees_user_id_users", "employees", type_="foreignkey")

    op.create_foreign_key(
        "fk_employees_user_id_users",
        "employees",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_employees_user_id_tenant_scoped",
        "employees",
        "users",
        ["user_id", "company_id"],
        ["id", "company_id"],
        ondelete="CASCADE",
    )

    op.alter_column("employees", "user_id", existing_type=sa.UUID(), nullable=False)

    op.drop_column("employees", "work_email")
    op.drop_column("employees", "last_name")
    op.drop_column("employees", "first_name")

    # RBAC backfill is not reversed (same policy as 8f4c2b91a0e7).
