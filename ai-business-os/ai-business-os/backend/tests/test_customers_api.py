"""Part 06.2 — Customers API: tenant isolation, RBAC, mass assignment, CRUD.

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
_EMAIL_DOMAIN = "customersapitest.example.com"
_BASE = "/api/v1/crm/customers"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "CustomersApi1234"
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
                        select(User.company_id).where(User.id.in_(user_ids))
                    )
                ).scalars().all()
                role_ids = (
                    await db.execute(
                        select(Role.id).where(Role.company_id.in_(company_ids))
                    )
                ).scalars().all()

                if company_ids:
                    await db.execute(
                        delete(Customer).where(Customer.company_id.in_(company_ids))
                    )
                    await db.execute(
                        delete(AuditLog).where(AuditLog.company_id.in_(company_ids))
                    )
                if user_ids:
                    await db.execute(delete(Session).where(Session.user_id.in_(user_ids)))
                    await db.execute(
                        delete(AuthToken).where(AuthToken.user_id.in_(user_ids))
                    )
                    await db.execute(
                        user_roles.delete().where(user_roles.c.user_id.in_(user_ids))
                    )
                if role_ids:
                    await db.execute(
                        role_permissions.delete().where(
                            role_permissions.c.role_id.in_(role_ids)
                        )
                    )
                    await db.execute(delete(Role).where(Role.id.in_(role_ids)))
                if user_ids:
                    await db.execute(delete(User).where(User.id.in_(user_ids)))
                if company_ids:
                    await db.execute(delete(Company).where(Company.id.in_(company_ids)))
                await db.commit()
        finally:
            await cleanup_engine.dispose()

    asyncio.run(_sweep())


def _create_customer(client: TestClient, session: dict, **overrides) -> dict:
    body = {
        "companyName": overrides.pop("companyName", "Acme Corp"),
        "email": overrides.pop("email", None),
        "phone": overrides.pop("phone", None),
        "city": overrides.pop("city", None),
        "status": overrides.pop("status", "lead"),
        "ownerId": overrides.pop("ownerId", None),
    }
    body = {k: v for k, v in body.items() if v is not None}
    body.update(overrides)
    res = client.post(_BASE, json=body, headers=_auth(session))
    assert res.status_code == 201, res.text
    return res.json()["data"]


# ---------------------------------------------------------------------------
# Happy path + envelope
# ---------------------------------------------------------------------------


def test_create_get_list_update_archive_flow(client):
    a = _register(client, "flow")
    created = _create_customer(
        client,
        a,
        companyName="Flow Industries",
        email="flow@example.com",
        status="active",
        ownerId=a["user"]["id"],
    )
    assert created["companyName"] == "Flow Industries"
    assert created["companyId"] == a["user"]["companyId"]
    assert created["ownerId"] == a["user"]["id"]
    assert created["deletedAt"] is None

    got = client.get(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert got.status_code == 200
    assert got.json()["data"]["id"] == created["id"]

    listed = client.get(_BASE, headers=_auth(a))
    assert listed.status_code == 200
    payload = listed.json()["data"]
    assert any(item["id"] == created["id"] for item in payload["items"])
    assert payload["meta"]["page"] == 1
    assert payload["meta"]["pageSize"] == 20

    patched = client.patch(
        f"{_BASE}/{created['id']}",
        json={"companyName": "Flow Industries Ltd", "status": "inactive"},
        headers=_auth(a),
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["companyName"] == "Flow Industries Ltd"
    assert patched.json()["data"]["status"] == "inactive"

    archived = client.delete(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert archived.status_code == 200
    assert archived.json()["success"] is True

    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 404
    listed_after = client.get(_BASE, headers=_auth(a))
    assert all(item["id"] != created["id"] for item in listed_after.json()["data"]["items"])


# ---------------------------------------------------------------------------
# Tenant isolation (HARD GATE)
# ---------------------------------------------------------------------------


def test_tenant_a_list_excludes_tenant_b(client):
    a = _register(client, "lista")
    b = _register(client, "listb")
    a_cust = _create_customer(client, a, companyName="Only A")
    b_cust = _create_customer(client, b, companyName="Only B")

    a_list = client.get(_BASE, headers=_auth(a)).json()["data"]["items"]
    b_list = client.get(_BASE, headers=_auth(b)).json()["data"]["items"]
    a_ids = {item["id"] for item in a_list}
    b_ids = {item["id"] for item in b_list}

    assert a_cust["id"] in a_ids
    assert b_cust["id"] not in a_ids
    assert b_cust["id"] in b_ids
    assert a_cust["id"] not in b_ids


def test_tenant_a_get_tenant_b_customer_is_404(client):
    a = _register(client, "geta")
    b = _register(client, "getb")
    b_cust = _create_customer(client, b, companyName="Secret B")

    res = client.get(f"{_BASE}/{b_cust['id']}", headers=_auth(a))
    assert res.status_code == 404
    assert res.json()["success"] is False
    assert "another" not in res.json()["message"].lower()


def test_tenant_a_patch_tenant_b_customer_is_404_and_unchanged(client):
    a = _register(client, "patcha")
    b = _register(client, "patchb")
    b_cust = _create_customer(client, b, companyName="Immutable B")

    res = client.patch(
        f"{_BASE}/{b_cust['id']}",
        json={"companyName": "Hijacked"},
        headers=_auth(a),
    )
    assert res.status_code == 404

    still = client.get(f"{_BASE}/{b_cust['id']}", headers=_auth(b))
    assert still.status_code == 200
    assert still.json()["data"]["companyName"] == "Immutable B"


def test_tenant_a_delete_tenant_b_customer_is_404_and_active(client):
    a = _register(client, "dela")
    b = _register(client, "delb")
    b_cust = _create_customer(client, b, companyName="Stay Alive B")

    res = client.delete(f"{_BASE}/{b_cust['id']}", headers=_auth(a))
    assert res.status_code == 404

    still = client.get(f"{_BASE}/{b_cust['id']}", headers=_auth(b))
    assert still.status_code == 200
    assert still.json()["data"]["deletedAt"] is None


def test_create_ignores_forged_company_id_from_body(client):
    a = _register(client, "forgeco")
    b = _register(client, "forgeco-b")

    res = client.post(
        _BASE,
        json={
            "companyName": "Should Stay In A",
            "companyId": b["user"]["companyId"],
            "company_id": b["user"]["companyId"],
        },
        headers=_auth(a),
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["companyId"] == a["user"]["companyId"]
    assert data["companyId"] != b["user"]["companyId"]


def test_cross_tenant_owner_assignment_rejected(client):
    a = _register(client, "ownera")
    b = _register(client, "ownerb")

    res = client.post(
        _BASE,
        json={"companyName": "Bad Owner", "ownerId": b["user"]["id"]},
        headers=_auth(a),
    )
    assert res.status_code == 422
    assert res.json()["success"] is False

    # PATCH path
    created = _create_customer(client, a, companyName="Has Owner Later")
    patch = client.patch(
        f"{_BASE}/{created['id']}",
        json={"ownerId": b["user"]["id"]},
        headers=_auth(a),
    )
    assert patch.status_code == 422


def test_owner_filter_cannot_expose_other_tenant(client):
    a = _register(client, "filta")
    b = _register(client, "filtb")
    _create_customer(client, a, companyName="A Owned", ownerId=a["user"]["id"])
    b_cust = _create_customer(client, b, companyName="B Owned", ownerId=b["user"]["id"])

    # Filtering by Tenant B's user id from Tenant A must not return B's customer
    res = client.get(
        _BASE,
        params={"ownerId": b["user"]["id"]},
        headers=_auth(a),
    )
    assert res.status_code == 200
    ids = {item["id"] for item in res.json()["data"]["items"]}
    assert b_cust["id"] not in ids


# ---------------------------------------------------------------------------
# Mass assignment (HARD GATE) — live HTTP
# ---------------------------------------------------------------------------


def test_create_mass_assignment_protected_fields_ignored(client):
    a = _register(client, "massa")
    forged_id = str(uuid.uuid4())
    res = client.post(
        _BASE,
        json={
            "companyName": "Mass Safe",
            "id": forged_id,
            "companyId": str(uuid.uuid4()),
            "createdBy": str(uuid.uuid4()),
            "updatedBy": str(uuid.uuid4()),
            "deletedAt": "2020-01-01T00:00:00Z",
            "isActive": False,
        },
        headers=_auth(a),
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["id"] != forged_id
    assert data["companyId"] == a["user"]["companyId"]
    assert data["createdBy"] == a["user"]["id"]
    assert data["deletedAt"] is None
    assert data["isActive"] is True


def test_update_mass_assignment_protected_fields_ignored(client):
    a = _register(client, "massu")
    created = _create_customer(client, a, companyName="Before Mass")
    original_id = created["id"]
    original_company = created["companyId"]

    res = client.patch(
        f"{_BASE}/{original_id}",
        json={
            "companyName": "After Mass",
            "id": str(uuid.uuid4()),
            "companyId": str(uuid.uuid4()),
            "createdBy": str(uuid.uuid4()),
            "updatedBy": str(uuid.uuid4()),
            "deletedAt": "2020-01-01T00:00:00Z",
        },
        headers=_auth(a),
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["id"] == original_id
    assert data["companyId"] == original_company
    assert data["companyName"] == "After Mass"
    assert data["deletedAt"] is None
    assert data["updatedBy"] == a["user"]["id"]


# ---------------------------------------------------------------------------
# RBAC (HARD GATE)
# ---------------------------------------------------------------------------


def _set_user_role(user_id: str, role_name: str) -> None:
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload
    from sqlalchemy.pool import NullPool

    from app.models import Role, User

    async def _run():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                user = (
                    await db.execute(
                        select(User)
                        .where(User.id == uuid.UUID(user_id))
                        .options(selectinload(User.roles))
                    )
                ).scalar_one()
                role = (
                    await db.execute(
                        select(Role).where(
                            Role.company_id == user.company_id,
                            Role.name == role_name,
                        )
                    )
                ).scalar_one()
                user.roles = [role]
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())


def _login(client: TestClient, email: str, password: str, company_slug: str) -> dict:
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
            "companySlug": company_slug,
        },
    )
    assert res.status_code == 200, res.text
    token = res.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_rbac_viewer_can_read_but_not_mutate(client):
    owner = _register(client, "rbacown")
    created = _create_customer(client, owner, companyName="RBAC Target")

    _set_user_role(owner["user"]["id"], "Viewer")
    headers = _login(
        client,
        owner["email"],
        owner["password"],
        owner["user"]["companySlug"],
    )

    assert client.get(_BASE, headers=headers).status_code == 200
    assert client.get(f"{_BASE}/{created['id']}", headers=headers).status_code == 200
    assert (
        client.post(
            _BASE, json={"companyName": "Nope"}, headers=headers
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{_BASE}/{created['id']}",
            json={"companyName": "Nope"},
            headers=headers,
        ).status_code
        == 403
    )
    assert client.delete(f"{_BASE}/{created['id']}", headers=headers).status_code == 403


def test_unauthenticated_customers_rejected(client):
    assert client.get(_BASE).status_code == 401
    assert client.post(_BASE, json={"companyName": "X"}).status_code == 401


# ---------------------------------------------------------------------------
# Pagination / sort / search / filter
# ---------------------------------------------------------------------------


def test_pagination_meta_and_clamping(client):
    a = _register(client, "page")
    for i in range(5):
        _create_customer(client, a, companyName=f"Page Co {i:02d}")

    default = client.get(_BASE, headers=_auth(a))
    meta = default.json()["data"]["meta"]
    assert meta["page"] == 1
    assert meta["pageSize"] == 20
    assert meta["total"] >= 5
    assert meta["totalPages"] >= 1

    page1 = client.get(_BASE, params={"page": 1, "pageSize": 2}, headers=_auth(a))
    body = page1.json()["data"]
    assert len(body["items"]) == 2
    assert body["meta"]["page"] == 1
    assert body["meta"]["pageSize"] == 2
    assert body["meta"]["total"] >= 5
    assert body["meta"]["totalPages"] == max(1, -(-body["meta"]["total"] // 2))

    page2 = client.get(_BASE, params={"page": 2, "pageSize": 2}, headers=_auth(a))
    assert len(page2.json()["data"]["items"]) == 2

    beyond = client.get(_BASE, params={"page": 999, "pageSize": 2}, headers=_auth(a))
    assert beyond.status_code == 200
    assert beyond.json()["data"]["items"] == []
    assert beyond.json()["data"]["meta"]["total"] >= 5

    huge = client.get(_BASE, params={"pageSize": 500}, headers=_auth(a))
    # Query le=100 rejects oversized pageSize at validation layer
    assert huge.status_code == 422


def test_sort_allowlist_and_rejection(client):
    a = _register(client, "sort")
    _create_customer(client, a, companyName="Zulu")
    _create_customer(client, a, companyName="Alpha")

    asc = client.get(
        _BASE,
        params={"sortBy": "company_name", "sortDesc": False, "pageSize": 50},
        headers=_auth(a),
    )
    assert asc.status_code == 200
    names = [i["companyName"] for i in asc.json()["data"]["items"]]
    assert names == sorted(names)

    bad = client.get(
        _BASE,
        params={"sortBy": "password_hash"},
        headers=_auth(a),
    )
    assert bad.status_code == 422


def test_search_fields_case_insensitive_and_tenant_safe(client):
    a = _register(client, "searcha")
    b = _register(client, "searchb")
    a_cust = _create_customer(
        client,
        a,
        companyName="Nordic Widgets",
        email="sales@Nordic.example",
        phone="+47-555-0100",
        city="Oslo",
    )
    b_cust = _create_customer(
        client,
        b,
        companyName="Nordic Widgets",
        email="sales@Nordic.example",
        phone="+47-555-0100",
        city="Oslo",
    )

    for term in ("nordic", "SALES@nordic", "555-0100", "oslo"):
        res = client.get(_BASE, params={"search": term}, headers=_auth(a))
        assert res.status_code == 200
        ids = {item["id"] for item in res.json()["data"]["items"]}
        assert a_cust["id"] in ids
        assert b_cust["id"] not in ids


def test_status_and_owner_filters(client):
    a = _register(client, "filt")
    lead = _create_customer(client, a, companyName="Lead Co", status="lead")
    active = _create_customer(
        client,
        a,
        companyName="Active Co",
        status="active",
        ownerId=a["user"]["id"],
    )

    by_status = client.get(_BASE, params={"status": "active"}, headers=_auth(a))
    ids = {item["id"] for item in by_status.json()["data"]["items"]}
    assert active["id"] in ids
    assert lead["id"] not in ids

    by_owner = client.get(
        _BASE, params={"ownerId": a["user"]["id"]}, headers=_auth(a)
    )
    owner_ids = {item["id"] for item in by_owner.json()["data"]["items"]}
    assert active["id"] in owner_ids
    assert lead["id"] not in owner_ids

    bad_status = client.get(_BASE, params={"status": "nope"}, headers=_auth(a))
    assert bad_status.status_code == 422


# ---------------------------------------------------------------------------
# Validation + soft delete + audit + OpenAPI
# ---------------------------------------------------------------------------


def test_create_validation_errors(client):
    a = _register(client, "val")
    missing = client.post(_BASE, json={}, headers=_auth(a))
    assert missing.status_code == 422

    bad_status = client.post(
        _BASE,
        json={"companyName": "X", "status": "not-real"},
        headers=_auth(a),
    )
    assert bad_status.status_code == 422

    oversized = client.post(
        _BASE,
        json={"companyName": "X" * 201},
        headers=_auth(a),
    )
    assert oversized.status_code == 422

    bad_owner = client.post(
        _BASE,
        json={"companyName": "X", "ownerId": "not-a-uuid"},
        headers=_auth(a),
    )
    assert bad_owner.status_code == 422


def test_soft_delete_sets_deleted_at_via_repo_semantics(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import Customer

    a = _register(client, "softdel")
    created = _create_customer(client, a, companyName="Archive Me")
    assert client.delete(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 200

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                row = (
                    await db.execute(
                        select(Customer).where(Customer.id == uuid.UUID(created["id"]))
                    )
                ).scalar_one()
                assert row.deleted_at is not None
        finally:
            await engine.dispose()

    asyncio.run(_check())


def test_mutations_write_audit_events(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import AuditLog

    a = _register(client, "audit")
    created = _create_customer(client, a, companyName="Audited Co")
    client.patch(
        f"{_BASE}/{created['id']}",
        json={"city": "Berlin"},
        headers=_auth(a),
    )
    client.delete(f"{_BASE}/{created['id']}", headers=_auth(a))

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                actions = set(
                    (
                        await db.execute(
                            select(AuditLog.action).where(
                                AuditLog.company_id == uuid.UUID(a["user"]["companyId"]),
                                AuditLog.entity == "customers",
                                AuditLog.entity_id == uuid.UUID(created["id"]),
                            )
                        )
                    ).scalars().all()
                )
                assert "customer.created" in actions
                assert "customer.updated" in actions
                assert "customer.archived" in actions
        finally:
            await engine.dispose()

    asyncio.run(_check())


def test_failed_cross_tenant_delete_does_not_audit_archive(client):
    import asyncio

    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import AuditLog

    a = _register(client, "noaudita")
    b = _register(client, "noauditb")
    b_cust = _create_customer(client, b, companyName="No Archive Leak")

    assert client.delete(f"{_BASE}/{b_cust['id']}", headers=_auth(a)).status_code == 404

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                count = (
                    await db.execute(
                        select(func.count()).select_from(AuditLog).where(
                            AuditLog.action == "customer.archived",
                            AuditLog.entity_id == uuid.UUID(b_cust["id"]),
                            AuditLog.company_id == uuid.UUID(a["user"]["companyId"]),
                        )
                    )
                ).scalar_one()
                assert count == 0
        finally:
            await engine.dispose()

    asyncio.run(_check())


def test_openapi_includes_customer_routes_without_writable_system_fields(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    spec = res.json()
    paths = spec["paths"]
    assert "/api/v1/crm/customers" in paths
    assert "/api/v1/crm/customers/{customer_id}" in paths

    collection = paths["/api/v1/crm/customers"]
    assert set(collection.keys()) >= {"get", "post"}
    detail = paths["/api/v1/crm/customers/{customer_id}"]
    assert set(detail.keys()) >= {"get", "patch", "delete"}

    post_body = collection["post"]["requestBody"]["content"]["application/json"]["schema"]
    # Resolve $ref if present
    schema = post_body
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        schema = spec["components"]["schemas"][ref]
    props = schema.get("properties", {})
    for forbidden in ("companyId", "company_id", "createdBy", "updatedBy", "deletedAt", "id"):
        assert forbidden not in props
