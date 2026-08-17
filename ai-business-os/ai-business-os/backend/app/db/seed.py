"""Seed data: global permission catalog + default system roles.

Idempotent — safe to run on every deploy::

    python -m app.db.seed

Also backfills ``role_permissions`` for each company's *system* roles so
existing tenants pick up catalog growth (e.g. CRM modules added after the
company was registered). Custom (non-system) roles are never modified.
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models import Permission, Role

MODULES: dict[str, list[str]] = {
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

# Which permissions each default role receives (Owner gets everything).
DEFAULT_ROLES: dict[str, str | list[str]] = {
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


def all_permission_names() -> list[str]:
    return [f"{module}.{action}" for module, actions in MODULES.items() for action in actions]


def expand(patterns: str | list[str]) -> set[str]:
    catalog = all_permission_names()
    if patterns == "*":
        return set(catalog)
    out: set[str] = set()
    for p in patterns:
        if p.endswith(".*"):
            prefix = p[:-1]  # keep the dot
            out.update(name for name in catalog if name.startswith(prefix))
        else:
            out.add(p)
    return out


async def seed_permissions(db: AsyncSession | None = None) -> int:
    """Insert any missing rows into the global ``permissions`` catalog.

    Returns the number of newly created permission rows.
    """
    if db is not None:
        return await _seed_permissions_into(db)

    async with AsyncSessionLocal() as session:
        created = await _seed_permissions_into(session)
        await session.commit()
        print(f"permissions: {created} created")
        return created


async def _seed_permissions_into(db: AsyncSession) -> int:
    existing = set((await db.execute(select(Permission.name))).scalars().all())
    created = 0
    for name in all_permission_names():
        if name not in existing:
            db.add(Permission(name=name, description=f"Allows {name.replace('.', ' → ')}"))
            created += 1
    await db.flush()
    return created


async def sync_system_role_permissions(db: AsyncSession | None = None) -> int:
    """Grant missing template permissions to every system role.

    Only roles with ``is_system=True`` whose name is in ``DEFAULT_ROLES``
    are updated. Existing grants are kept; only missing names are added.

    Returns the number of ``role_permissions`` rows inserted.
    """
    if db is not None:
        return await _sync_system_role_permissions_into(db)

    async with AsyncSessionLocal() as session:
        added = await _sync_system_role_permissions_into(session)
        await session.commit()
        print(f"system role_permissions: {added} grants added")
        return added


async def _sync_system_role_permissions_into(db: AsyncSession) -> int:
    expected_catalog = set(all_permission_names())
    catalog = {
        p.name: p for p in (await db.execute(select(Permission))).scalars().all()
    }
    missing_catalog = expected_catalog - set(catalog)
    if missing_catalog:
        raise RuntimeError(
            "Permission catalog incomplete before role sync; "
            f"missing {sorted(missing_catalog)[:5]}… "
            "Run seed_permissions() first."
        )

    roles = (
        await db.execute(
            select(Role)
            .where(
                Role.is_system.is_(True),
                Role.name.in_(tuple(DEFAULT_ROLES.keys())),
            )
            .options(selectinload(Role.permissions))
        )
    ).scalars().all()

    added = 0
    for role in roles:
        pattern = DEFAULT_ROLES[role.name]
        want = expand(pattern)
        have = {p.name for p in role.permissions}
        for name in sorted(want - have):
            role.permissions.append(catalog[name])
            added += 1
    await db.flush()
    return added


async def run_seed() -> None:
    async with AsyncSessionLocal() as db:
        created = await _seed_permissions_into(db)
        added = await _sync_system_role_permissions_into(db)
        await db.commit()
        print(f"permissions: {created} created")
        print(f"system role_permissions: {added} grants added")


if __name__ == "__main__":
    asyncio.run(run_seed())
