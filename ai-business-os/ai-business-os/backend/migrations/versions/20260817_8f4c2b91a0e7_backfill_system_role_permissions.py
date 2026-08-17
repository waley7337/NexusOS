"""Backfill system role_permissions for existing tenants.

Revision ID: 8f4c2b91a0e7
Revises: 217e90d00cc0
Create Date: 2026-08-17

Production symptom: workspace Owners hit Access denied on /crm because
``PermissionRoute(customers.read)`` correctly denied an empty permissions
list from ``GET /auth/me``. Registration snapshots ``role_permissions``
from the global catalog at company-create time; ``seed_permissions()``
historically only filled the catalog and never backfilled existing
system roles. Companies registered before (or without) a complete catalog
therefore kept Owner/Admin roles with zero CRM grants.

This migration is idempotent data-only:
  1. Ensure every catalog permission row exists.
  2. For each *system* role whose name is in the default template set,
     INSERT any missing ``role_permissions`` rows.

Custom (non-system) roles are never modified.
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "8f4c2b91a0e7"
down_revision = "217e90d00cc0"
branch_labels = None
depends_on = None

# Keep in sync with app.db.seed.MODULES / DEFAULT_ROLES / expand().
_MODULES: dict[str, list[str]] = {
    "customers": ["read", "create", "update", "delete"],
    "contacts": ["read", "create", "update", "delete"],
    "leads": ["read", "create", "update", "delete"],
    "deals": ["read", "create", "update", "delete"],
    "projects": ["read", "create", "update", "delete", "manage"],
    "tasks": ["read", "create", "update", "delete"],
    "hr": ["read", "manage"],
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
    ],
    "Employee": [
        "customers.read", "contacts.read", "leads.read", "projects.read",
        "tasks.*", "documents.read", "documents.upload", "ai.use",
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
            conn.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_id, permission_id) "
                    "VALUES (:role_id, :permission_id) "
                    "ON CONFLICT DO NOTHING"
                ),
                {"role_id": role_id, "permission_id": perm_ids[name]},
            )


def downgrade() -> None:
    # Data backfill is not reversed — removing grants would lock Owners out
    # of CRM again. Catalog rows inserted here are also left in place.
    pass
