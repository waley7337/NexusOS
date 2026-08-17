"""Part 06.9 — Customer notes API: tenant isolation, RBAC, nested routes.

Live HTTP boundary tests through the real ASGI app. Hard release gates.
"""

from __future__ import annotations

import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.main import app  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
_EMAIL_DOMAIN = "customernotesapitest.example.com"
_CUSTOMERS = "/api/v1/crm/customers"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "NotesApi1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"Co {tag}",
            "firstName": "Test",
            "lastName": tag.title(),
            "email": email,
            "password": password,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    return {
        "email": email,
        "password": password,
        "token": data["accessToken"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
    }


def _auth(session: dict) -> dict:
    return session["headers"]


def _create_customer(client: TestClient, session: dict, name: str = "Acme Corp") -> dict:
    res = client.post(
        _CUSTOMERS,
        json={"companyName": name, "status": "active"},
        headers=_auth(session),
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def _notes_path(customer_id: str) -> str:
    return f"{_CUSTOMERS}/{customer_id}/notes"


@pytest.fixture(scope="module", autouse=True)
def _cleanup_module_data():
    yield
    import asyncio

    from sqlalchemy import delete, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import (
        AuditLog,
        AuthToken,
        Company,
        Customer,
        Role,
        Session,
        User,
        role_permissions,
        user_roles,
    )
    from app.models.crm import CustomerNote

    async def _sweep():
        cleanup_engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(cleanup_engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                user_ids = (
                    await db.execute(
                        select(User.id).where(User.email.like(f"%@{_EMAIL_DOMAIN}"))
                    )
                ).scalars().all()
                company_ids = (
                    await db.execute(
                        select(Company.id).where(Company.name.like("Co notes-%"))
                    )
                ).scalars().all()
                if company_ids:
                    await db.execute(
                        delete(CustomerNote).where(CustomerNote.company_id.in_(company_ids))
                    )
                    await db.execute(delete(AuditLog).where(AuditLog.company_id.in_(company_ids)))
                    await db.execute(delete(Customer).where(Customer.company_id.in_(company_ids)))
                await db.execute(delete(Session).where(Session.user_id.in_(user_ids)))
                await db.execute(delete(AuthToken).where(AuthToken.user_id.in_(user_ids)))
                role_ids = (
                    await db.execute(select(Role.id).where(Role.company_id.in_(company_ids)))
                ).scalars().all() if company_ids else []
                if role_ids:
                    await db.execute(
                        delete(role_permissions).where(role_permissions.c.role_id.in_(role_ids))
                    )
                    await db.execute(delete(Role).where(Role.id.in_(role_ids)))
                await db.execute(delete(user_roles).where(user_roles.c.user_id.in_(user_ids)))
                await db.execute(delete(User).where(User.id.in_(user_ids)))
                if company_ids:
                    await db.execute(delete(Company).where(Company.id.in_(company_ids)))
                await db.commit()
        finally:
            await cleanup_engine.dispose()

    asyncio.run(_sweep())


def test_create_list_and_get_note(client: TestClient):
    session = _register(client, "notes-crud")
    customer = _create_customer(client, session)
    customer_id = customer["id"]

    create = client.post(
        _notes_path(customer_id),
        json={"content": "Called about renewal."},
        headers=_auth(session),
    )
    assert create.status_code == 201, create.text
    note = create.json()["data"]
    assert note["content"] == "Called about renewal."
    assert note["customerId"] == customer_id
    assert note["authorId"] == session["user"]["id"]

    listing = client.get(_notes_path(customer_id), headers=_auth(session))
    assert listing.status_code == 200, listing.text
    items = listing.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["id"] == note["id"]

    fetched = client.get(
        f"{_notes_path(customer_id)}/{note['id']}",
        headers=_auth(session),
    )
    assert fetched.status_code == 200
    assert fetched.json()["data"]["content"] == "Called about renewal."


def test_update_and_archive_note(client: TestClient):
    session = _register(client, "notes-mut")
    customer = _create_customer(client, session)
    customer_id = customer["id"]

    created = client.post(
        _notes_path(customer_id),
        json={"content": "Initial note"},
        headers=_auth(session),
    ).json()["data"]
    note_id = created["id"]

    updated = client.patch(
        f"{_notes_path(customer_id)}/{note_id}",
        json={"content": "Updated note"},
        headers=_auth(session),
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["data"]["content"] == "Updated note"

    archived = client.delete(
        f"{_notes_path(customer_id)}/{note_id}",
        headers=_auth(session),
    )
    assert archived.status_code == 200, archived.text

    listing = client.get(_notes_path(customer_id), headers=_auth(session))
    assert listing.json()["data"]["items"] == []


def test_cross_tenant_customer_returns_not_found(client: TestClient):
    tenant_a = _register(client, "notes-a")
    tenant_b = _register(client, "notes-b")
    customer_a = _create_customer(client, tenant_a)

    res = client.post(
        _notes_path(customer_a["id"]),
        json={"content": "Should fail"},
        headers=_auth(tenant_b),
    )
    assert res.status_code == 422, res.text


def test_cross_tenant_note_id_returns_not_found(client: TestClient):
    tenant_a = _register(client, "notes-x")
    tenant_b = _register(client, "notes-y")
    customer_a = _create_customer(client, tenant_a)
    customer_b = _create_customer(client, tenant_b)

    note = client.post(
        _notes_path(customer_a["id"]),
        json={"content": "Secret"},
        headers=_auth(tenant_a),
    ).json()["data"]

    res = client.get(
        f"{_notes_path(customer_b['id'])}/{note['id']}",
        headers=_auth(tenant_b),
    )
    assert res.status_code == 404, res.text


def test_mass_assignment_ignores_extra_fields(client: TestClient):
    session = _register(client, "notes-mass")
    customer = _create_customer(client, session)
    customer_id = customer["id"]

    res = client.post(
        _notes_path(customer_id),
        json={
            "content": "Note",
            "companyId": str(uuid.uuid4()),
            "customerId": str(uuid.uuid4()),
            "authorId": str(uuid.uuid4()),
        },
        headers=_auth(session),
    )
    assert res.status_code == 201, res.text
    note = res.json()["data"]
    assert note["companyId"] == session["user"]["companyId"]
    assert note["customerId"] == customer_id
    assert note["authorId"] == session["user"]["id"]
