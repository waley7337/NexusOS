"""Part 06.6 — Leads API: tenant isolation, cross-tenant Customer/assignee FK, RBAC.

Live HTTP boundary tests through the real ASGI app. Hard release gates.
Does not exercise Deals, Notes, Meetings, or RLS.
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
_EMAIL_DOMAIN = "leadsapitest.example.com"
_CUSTOMERS = "/api/v1/crm/customers"
_BASE = "/api/v1/crm/leads"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "LeadsApi1234"
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


def _create_lead(client: TestClient, session: dict, customer_id: str, **overrides) -> dict:
    body = {
        "customerId": customer_id,
        "pipelineStage": overrides.pop("pipelineStage", "new"),
        "estimatedValue": overrides.pop("estimatedValue", None),
        "probability": overrides.pop("probability", None),
        "expectedCloseDate": overrides.pop("expectedCloseDate", None),
        "assignedTo": overrides.pop("assignedTo", None),
        "notes": overrides.pop("notes", None),
    }
    body = {k: v for k, v in body.items() if v is not None}
    body.update(overrides)
    res = client.post(_BASE, json=body, headers=_auth(session))
    assert res.status_code == 201, res.text
    return res.json()["data"]


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
        Contact,
        Customer,
        Lead,
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
                        delete(Lead).where(Lead.company_id.in_(company_ids))
                    )
                    await db.execute(
                        delete(Contact).where(Contact.company_id.in_(company_ids))
                    )
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


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_create_get_list_update_archive_flow(client):
    a = _register(client, "flow")
    customer = _create_customer(client, a, "Flow Co")
    created = _create_lead(
        client,
        a,
        customer["id"],
        pipelineStage="qualified",
        estimatedValue="15000.50",
        probability=40,
        notes="Initial discovery",
        assignedTo=a["user"]["id"],
    )
    assert created["customerId"] == customer["id"]
    assert created["companyId"] == a["user"]["companyId"]
    assert created["pipelineStage"] == "qualified"
    assert created["assignedTo"] == a["user"]["id"]
    assert created["deletedAt"] is None

    got = client.get(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert got.status_code == 200
    assert got.json()["data"]["probability"] == 40

    listed = client.get(_BASE, headers=_auth(a))
    assert listed.status_code == 200
    assert any(item["id"] == created["id"] for item in listed.json()["data"]["items"])

    patched = client.patch(
        f"{_BASE}/{created['id']}",
        json={"pipelineStage": "proposal", "probability": 60},
        headers=_auth(a),
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["pipelineStage"] == "proposal"
    assert patched.json()["data"]["probability"] == 60

    archived = client.delete(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert archived.status_code == 200
    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 404
    assert all(
        item["id"] != created["id"]
        for item in client.get(_BASE, headers=_auth(a)).json()["data"]["items"]
    )


# ---------------------------------------------------------------------------
# Tenant isolation + cross-tenant Customer / assignee FK (HARD GATE)
# ---------------------------------------------------------------------------


def test_tenant_a_list_excludes_tenant_b(client):
    a = _register(client, "lista")
    b = _register(client, "listb")
    ca = _create_customer(client, a, "Only A")
    cb = _create_customer(client, b, "Only B")
    a_lead = _create_lead(client, a, ca["id"], notes="A lead")
    b_lead = _create_lead(client, b, cb["id"], notes="B lead")

    a_ids = {i["id"] for i in client.get(_BASE, headers=_auth(a)).json()["data"]["items"]}
    b_ids = {i["id"] for i in client.get(_BASE, headers=_auth(b)).json()["data"]["items"]}
    assert a_lead["id"] in a_ids and b_lead["id"] not in a_ids
    assert b_lead["id"] in b_ids and a_lead["id"] not in b_ids


def test_tenant_a_get_patch_delete_tenant_b_lead_is_404(client):
    a = _register(client, "xgeta")
    b = _register(client, "xgetb")
    cb = _create_customer(client, b, "B Co")
    b_lead = _create_lead(client, b, cb["id"], notes="Secret")

    assert client.get(f"{_BASE}/{b_lead['id']}", headers=_auth(a)).status_code == 404
    assert (
        client.patch(
            f"{_BASE}/{b_lead['id']}",
            json={"notes": "Hijacked"},
            headers=_auth(a),
        ).status_code
        == 404
    )
    assert client.delete(f"{_BASE}/{b_lead['id']}", headers=_auth(a)).status_code == 404

    still = client.get(f"{_BASE}/{b_lead['id']}", headers=_auth(b))
    assert still.status_code == 200
    assert still.json()["data"]["notes"] == "Secret"
    assert still.json()["data"]["deletedAt"] is None


def test_create_rejects_cross_tenant_customer_id(client):
    a = _register(client, "fkcrea")
    b = _register(client, "fkcreb")
    cb = _create_customer(client, b, "B Customer")

    res = client.post(
        _BASE,
        json={"customerId": cb["id"], "pipelineStage": "new"},
        headers=_auth(a),
    )
    assert res.status_code == 422
    assert res.json()["success"] is False
    a_list = client.get(_BASE, headers=_auth(a)).json()["data"]["items"]
    assert all(i["customerId"] != cb["id"] for i in a_list)


def test_update_rejects_cross_tenant_customer_id(client):
    a = _register(client, "fkupda")
    b = _register(client, "fkupdb")
    ca = _create_customer(client, a, "A Customer")
    cb = _create_customer(client, b, "B Customer")
    lead = _create_lead(client, a, ca["id"])

    res = client.patch(
        f"{_BASE}/{lead['id']}",
        json={"customerId": cb["id"]},
        headers=_auth(a),
    )
    assert res.status_code == 422

    still = client.get(f"{_BASE}/{lead['id']}", headers=_auth(a))
    assert still.json()["data"]["customerId"] == ca["id"]


def test_cross_tenant_assignee_rejected(client):
    a = _register(client, "asgna")
    b = _register(client, "asgnb")
    ca = _create_customer(client, a, "A Cust")

    create_res = client.post(
        _BASE,
        json={
            "customerId": ca["id"],
            "assignedTo": b["user"]["id"],
        },
        headers=_auth(a),
    )
    assert create_res.status_code == 422

    lead = _create_lead(client, a, ca["id"], assignedTo=a["user"]["id"])
    patch_res = client.patch(
        f"{_BASE}/{lead['id']}",
        json={"assignedTo": b["user"]["id"]},
        headers=_auth(a),
    )
    assert patch_res.status_code == 422
    still = client.get(f"{_BASE}/{lead['id']}", headers=_auth(a))
    assert still.json()["data"]["assignedTo"] == a["user"]["id"]


def test_filter_by_other_tenant_customer_exposes_nothing(client):
    a = _register(client, "filtca")
    b = _register(client, "filtcb")
    ca = _create_customer(client, a, "A Cust")
    cb = _create_customer(client, b, "B Cust")
    _create_lead(client, a, ca["id"], notes="A lead")
    b_lead = _create_lead(client, b, cb["id"], notes="B lead")

    res = client.get(_BASE, params={"customerId": cb["id"]}, headers=_auth(a))
    assert res.status_code == 200
    ids = {i["id"] for i in res.json()["data"]["items"]}
    assert b_lead["id"] not in ids
    assert ids == set() or all(
        i["companyId"] == a["user"]["companyId"]
        for i in res.json()["data"]["items"]
    )


def test_create_ignores_forged_company_id(client):
    a = _register(client, "forgeco")
    b = _register(client, "forgecob")
    ca = _create_customer(client, a, "A Co")

    res = client.post(
        _BASE,
        json={
            "customerId": ca["id"],
            "companyId": b["user"]["companyId"],
            "company_id": b["user"]["companyId"],
        },
        headers=_auth(a),
    )
    assert res.status_code == 201, res.text
    assert res.json()["data"]["companyId"] == a["user"]["companyId"]


# ---------------------------------------------------------------------------
# Mass assignment
# ---------------------------------------------------------------------------


def test_create_mass_assignment_protected_fields_ignored(client):
    a = _register(client, "massa")
    ca = _create_customer(client, a)
    forged_id = str(uuid.uuid4())
    res = client.post(
        _BASE,
        json={
            "customerId": ca["id"],
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
    ca = _create_customer(client, a)
    created = _create_lead(client, a, ca["id"], notes="Before")
    original_id = created["id"]
    original_company = created["companyId"]

    res = client.patch(
        f"{_BASE}/{original_id}",
        json={
            "notes": "After",
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
    assert data["notes"] == "After"
    assert data["deletedAt"] is None
    assert data["updatedBy"] == a["user"]["id"]


# ---------------------------------------------------------------------------
# RBAC
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
        json={"email": email, "password": password, "companySlug": company_slug},
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['data']['accessToken']}"}


def test_rbac_viewer_without_leads_cannot_mutate_or_read(client):
    """Viewer has customers.read but not leads.* — leads must 403."""
    owner = _register(client, "rbacown")
    customer = _create_customer(client, owner)
    lead = _create_lead(client, owner, customer["id"])

    _set_user_role(owner["user"]["id"], "Viewer")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )

    assert client.get(_BASE, headers=headers).status_code == 403
    assert client.get(f"{_BASE}/{lead['id']}", headers=headers).status_code == 403
    assert (
        client.post(
            _BASE,
            json={"customerId": customer["id"]},
            headers=headers,
        ).status_code
        == 403
    )


def test_rbac_employee_can_read_not_write(client):
    """Employee has leads.read but not create/update/delete."""
    owner = _register(client, "rbacemp")
    customer = _create_customer(client, owner)
    lead = _create_lead(client, owner, customer["id"])

    _set_user_role(owner["user"]["id"], "Employee")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )

    assert client.get(_BASE, headers=headers).status_code == 200
    assert client.get(f"{_BASE}/{lead['id']}", headers=headers).status_code == 200
    assert (
        client.post(
            _BASE,
            json={"customerId": customer["id"]},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{_BASE}/{lead['id']}",
            json={"notes": "Nope"},
            headers=headers,
        ).status_code
        == 403
    )
    assert client.delete(f"{_BASE}/{lead['id']}", headers=headers).status_code == 403


def test_unauthenticated_leads_rejected(client):
    assert client.get(_BASE).status_code == 401
    assert (
        client.post(
            _BASE,
            json={"customerId": str(uuid.uuid4())},
        ).status_code
        == 401
    )


# ---------------------------------------------------------------------------
# Pagination / sort / search / filter / validation / soft delete / audit / OpenAPI
# ---------------------------------------------------------------------------


def test_pagination_meta(client):
    a = _register(client, "page")
    customer = _create_customer(client, a)
    for i in range(5):
        _create_lead(client, a, customer["id"], notes=f"Lead {i}")

    default = client.get(_BASE, headers=_auth(a))
    meta = default.json()["data"]["meta"]
    assert meta["page"] == 1
    assert meta["pageSize"] == 20
    assert meta["total"] >= 5

    page1 = client.get(_BASE, params={"page": 1, "pageSize": 2}, headers=_auth(a))
    body = page1.json()["data"]
    assert len(body["items"]) == 2
    assert body["meta"]["pageSize"] == 2

    beyond = client.get(_BASE, params={"page": 999, "pageSize": 2}, headers=_auth(a))
    assert beyond.json()["data"]["items"] == []

    assert client.get(_BASE, params={"pageSize": 500}, headers=_auth(a)).status_code == 422


def test_sort_allowlist_and_rejection(client):
    a = _register(client, "sort")
    customer = _create_customer(client, a)
    _create_lead(client, a, customer["id"], estimatedValue="100.00")
    _create_lead(client, a, customer["id"], estimatedValue="500.00")

    asc = client.get(
        _BASE,
        params={"sortBy": "estimated_value", "sortDesc": False, "pageSize": 50},
        headers=_auth(a),
    )
    assert asc.status_code == 200
    values = [
        float(i["estimatedValue"])
        for i in asc.json()["data"]["items"]
        if i.get("estimatedValue") is not None
    ]
    assert values == sorted(values)

    stage = client.get(
        _BASE,
        params={"sortBy": "pipeline_stage", "sortDesc": False},
        headers=_auth(a),
    )
    assert stage.status_code == 200

    close = client.get(
        _BASE,
        params={"sortBy": "expected_close_date", "sortDesc": True},
        headers=_auth(a),
    )
    assert close.status_code == 200

    bad = client.get(_BASE, params={"sortBy": "password_hash"}, headers=_auth(a))
    assert bad.status_code == 422


def test_search_notes_case_insensitive_and_tenant_safe(client):
    a = _register(client, "searcha")
    b = _register(client, "searchb")
    ca = _create_customer(client, a)
    cb = _create_customer(client, b)
    a_lead = _create_lead(client, a, ca["id"], notes="Nordic pipeline opportunity")
    b_lead = _create_lead(client, b, cb["id"], notes="Nordic pipeline opportunity")

    res = client.get(_BASE, params={"search": "nordic"}, headers=_auth(a))
    assert res.status_code == 200
    ids = {i["id"] for i in res.json()["data"]["items"]}
    assert a_lead["id"] in ids
    assert b_lead["id"] not in ids


def test_customer_and_stage_and_assignee_filters(client):
    a = _register(client, "custf")
    c1 = _create_customer(client, a, "Cust One")
    c2 = _create_customer(client, a, "Cust Two")
    one = _create_lead(
        client, a, c1["id"], pipelineStage="qualified", assignedTo=a["user"]["id"]
    )
    two = _create_lead(client, a, c2["id"], pipelineStage="proposal")

    by_customer = client.get(
        _BASE, params={"customerId": c1["id"]}, headers=_auth(a)
    )
    ids = {i["id"] for i in by_customer.json()["data"]["items"]}
    assert one["id"] in ids
    assert two["id"] not in ids

    by_stage = client.get(
        _BASE, params={"pipelineStage": "proposal"}, headers=_auth(a)
    )
    stage_ids = {i["id"] for i in by_stage.json()["data"]["items"]}
    assert two["id"] in stage_ids
    assert one["id"] not in stage_ids

    by_assignee = client.get(
        _BASE, params={"assignedTo": a["user"]["id"]}, headers=_auth(a)
    )
    assignee_ids = {i["id"] for i in by_assignee.json()["data"]["items"]}
    assert one["id"] in assignee_ids
    assert two["id"] not in assignee_ids


def test_create_validation_errors(client):
    a = _register(client, "val")
    customer = _create_customer(client, a)

    missing = client.post(_BASE, json={}, headers=_auth(a))
    assert missing.status_code == 422

    bad_stage = client.post(
        _BASE,
        json={"customerId": customer["id"], "pipelineStage": "not-a-stage"},
        headers=_auth(a),
    )
    assert bad_stage.status_code == 422

    bad_probability = client.post(
        _BASE,
        json={"customerId": customer["id"], "probability": 150},
        headers=_auth(a),
    )
    assert bad_probability.status_code == 422

    unknown_customer = client.post(
        _BASE,
        json={"customerId": str(uuid.uuid4())},
        headers=_auth(a),
    )
    assert unknown_customer.status_code == 422


def test_estimated_value_non_negative(client):
    a = _register(client, "evval")
    customer = _create_customer(client, a)

    positive = client.post(
        _BASE,
        json={"customerId": customer["id"], "estimatedValue": "1500.50"},
        headers=_auth(a),
    )
    assert positive.status_code == 201, positive.text
    assert float(positive.json()["data"]["estimatedValue"]) == 1500.50

    zero = client.post(
        _BASE,
        json={"customerId": customer["id"], "estimatedValue": "0"},
        headers=_auth(a),
    )
    assert zero.status_code == 201, zero.text
    assert float(zero.json()["data"]["estimatedValue"]) == 0

    negative = client.post(
        _BASE,
        json={"customerId": customer["id"], "estimatedValue": "-1"},
        headers=_auth(a),
    )
    assert negative.status_code == 422

    created = _create_lead(client, a, customer["id"], estimatedValue="100")
    negative_update = client.patch(
        f"{_BASE}/{created['id']}",
        json={"estimatedValue": "-0.01"},
        headers=_auth(a),
    )
    assert negative_update.status_code == 422


def test_soft_delete_sets_deleted_at(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import Lead

    a = _register(client, "softdel")
    customer = _create_customer(client, a)
    created = _create_lead(client, a, customer["id"])
    assert client.delete(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 200

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                row = (
                    await db.execute(
                        select(Lead).where(Lead.id == uuid.UUID(created["id"]))
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
    customer = _create_customer(client, a)
    created = _create_lead(client, a, customer["id"], notes="Audited")
    client.patch(
        f"{_BASE}/{created['id']}",
        json={"pipelineStage": "negotiation"},
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
                                AuditLog.company_id
                                == uuid.UUID(a["user"]["companyId"]),
                                AuditLog.entity == "leads",
                                AuditLog.entity_id == uuid.UUID(created["id"]),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                assert "lead.created" in actions
                assert "lead.updated" in actions
                assert "lead.archived" in actions
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
    cb = _create_customer(client, b)
    b_lead = _create_lead(client, b, cb["id"])

    assert client.delete(f"{_BASE}/{b_lead['id']}", headers=_auth(a)).status_code == 404

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                count = (
                    await db.execute(
                        select(func.count())
                        .select_from(AuditLog)
                        .where(
                            AuditLog.action == "lead.archived",
                            AuditLog.entity_id == uuid.UUID(b_lead["id"]),
                            AuditLog.company_id
                            == uuid.UUID(a["user"]["companyId"]),
                        )
                    )
                ).scalar_one()
                assert count == 0
        finally:
            await engine.dispose()

    asyncio.run(_check())


def test_openapi_includes_lead_routes_without_writable_system_fields(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    spec = res.json()
    paths = spec["paths"]
    assert "/api/v1/crm/leads" in paths
    assert "/api/v1/crm/leads/{lead_id}" in paths

    collection = paths["/api/v1/crm/leads"]
    assert set(collection.keys()) >= {"get", "post"}
    detail = paths["/api/v1/crm/leads/{lead_id}"]
    assert set(detail.keys()) >= {"get", "patch", "delete"}

    post_body = collection["post"]["requestBody"]["content"]["application/json"]["schema"]
    schema = post_body
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        schema = spec["components"]["schemas"][ref]
    props = schema.get("properties", {})
    for forbidden in (
        "companyId",
        "company_id",
        "createdBy",
        "updatedBy",
        "deletedAt",
        "id",
    ):
        assert forbidden not in props
    assert "customerId" in props
    assert "pipelineStage" in props
    assert "assignedTo" in props
