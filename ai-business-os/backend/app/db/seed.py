"""Seed data: global permission catalog + default system roles.

Idempotent — safe to run on every deploy.
    python -m app.db.seed
"""
import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Permission

MODULES: dict[str, list[str]] = {
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

# Which permissions each default role receives (Owner gets everything).
DEFAULT_ROLES: dict[str, str | list[str]] = {
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


async def seed_permissions() -> None:
    async with AsyncSessionLocal() as db:
        existing = set(
            (await db.execute(select(Permission.name))).scalars().all()
        )
        created = 0
        for name in all_permission_names():
            if name not in existing:
                db.add(Permission(name=name, description=f"Allows {name.replace('.', ' → ')}"))
                created += 1
        await db.commit()
        print(f"permissions: {created} created, {len(existing)} already present")


if __name__ == "__main__":
    asyncio.run(seed_permissions())
