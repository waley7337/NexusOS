"""Part 06.8 — Deals API: tenant isolation, Lead FK, 1:1 invariant, RBAC.

Live HTTP boundary tests through the real ASGI app. Hard release gates.
Does not exercise Lead→Deal automation, Notes, Meetings, or RLS.
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
_EMAIL_DOMAIN = "dealsapitest.example.com"
_CUSTOMERS = "/api/v1/crm/customers"
_LEADS = "/api/v1/crm/leads"
_BASE = "/api/v1/crm/deals"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "DealsApi1234"
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
        "pipelineStage": overrides.pop("pipelineStage", "qualified"),
        "notes": overrides.pop("notes", None),
    }
    body = {k: v for k, v in body.items() if v is not None}
    body.update(overrides)
    res = client.post(_LEADS, json=body, headers=_auth(session))
    assert res.status_code == 201, res.text
    return res.json()["data"]


def _create_deal(client: TestClient, session: dict, lead_id: str, **overrides) -> dict:
    body = {
        "leadId": lead_id,
        "value": overrides.pop("value", "10000.00"),
        "currency": overrides.pop("currency", "USD"),
        "status": overrides.pop("status", "open"),
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
        Deal,
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
                        delete(Deal).where(Deal.company_id.in_(company_ids))
                    )
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
    lead = _create_lead(client, a, customer["id"])
    created = _create_deal(
        client,
        a,
        lead["id"],
        value="25000.50",
        currency="eur",
        status="open",
    )
    assert created["leadId"] == lead["id"]
    assert created["companyId"] == a["user"]["companyId"]
    assert created["currency"] == "EUR"
    assert created["status"] == "open"
    assert created["deletedAt"] is None

    got = client.get(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert got.status_code == 200
    assert float(got.json()["data"]["value"]) == 25000.50

    listed = client.get(_BASE, headers=_auth(a))
    assert listed.status_code == 200
    assert any(item["id"] == created["id"] for item in listed.json()["data"]["items"])

    patched = client.patch(
        f"{_BASE}/{created['id']}",
        json={"status": "won", "wonAt": "2026-08-01T12:00:00Z"},
        headers=_auth(a),
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["status"] == "won"
    # Lead stage must NOT auto-change
    lead_still = client.get(f"{_LEADS}/{lead['id']}", headers=_auth(a))
    assert lead_still.json()["data"]["pipelineStage"] == "qualified"

    archived = client.delete(f"{_BASE}/{created['id']}", headers=_auth(a))
    assert archived.status_code == 200
    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 404
    assert all(
        item["id"] != created["id"]
        for item in client.get(_BASE, headers=_auth(a)).json()["data"]["items"]
    )


def test_one_active_deal_per_lead(client):
    a = _register(client, "oneone")
    customer = _create_customer(client, a)
    lead = _create_lead(client, a, customer["id"])
    first = _create_deal(client, a, lead["id"], value="100")
    second = client.post(
        _BASE,
        json={"leadId": lead["id"], "value": "200"},
        headers=_auth(a),
    )
    assert second.status_code == 422
    assert second.json()["success"] is False

    # After archive, a new deal for the same lead is allowed
    assert client.delete(f"{_BASE}/{first['id']}", headers=_auth(a)).status_code == 200
    again = _create_deal(client, a, lead["id"], value="300")
    assert again["leadId"] == lead["id"]


# ---------------------------------------------------------------------------
# Tenant isolation + cross-tenant Lead FK (HARD GATE)
# ---------------------------------------------------------------------------


def test_tenant_a_list_excludes_tenant_b(client):
    a = _register(client, "lista")
    b = _register(client, "listb")
    ca = _create_customer(client, a, "Only A")
    cb = _create_customer(client, b, "Only B")
    la = _create_lead(client, a, ca["id"])
    lb = _create_lead(client, b, cb["id"])
    a_deal = _create_deal(client, a, la["id"], value="10")
    b_deal = _create_deal(client, b, lb["id"], value="20")

    a_ids = {i["id"] for i in client.get(_BASE, headers=_auth(a)).json()["data"]["items"]}
    b_ids = {i["id"] for i in client.get(_BASE, headers=_auth(b)).json()["data"]["items"]}
    assert a_deal["id"] in a_ids and b_deal["id"] not in a_ids
    assert b_deal["id"] in b_ids and a_deal["id"] not in b_ids


def test_tenant_a_get_patch_delete_tenant_b_deal_is_404(client):
    a = _register(client, "xgeta")
    b = _register(client, "xgetb")
    cb = _create_customer(client, b, "B Co")
    lb = _create_lead(client, b, cb["id"])
    b_deal = _create_deal(client, b, lb["id"], value="99")

    assert client.get(f"{_BASE}/{b_deal['id']}", headers=_auth(a)).status_code == 404
    assert (
        client.patch(
            f"{_BASE}/{b_deal['id']}",
            json={"value": "1"},
            headers=_auth(a),
        ).status_code
        == 404
    )
    assert client.delete(f"{_BASE}/{b_deal['id']}", headers=_auth(a)).status_code == 404

    still = client.get(f"{_BASE}/{b_deal['id']}", headers=_auth(b))
    assert still.status_code == 200
    assert float(still.json()["data"]["value"]) == 99
    assert still.json()["data"]["deletedAt"] is None


def test_create_rejects_cross_tenant_lead_id(client):
    a = _register(client, "fkcrea")
    b = _register(client, "fkcreb")
    cb = _create_customer(client, b, "B Customer")
    lb = _create_lead(client, b, cb["id"])

    res = client.post(
        _BASE,
        json={"leadId": lb["id"], "value": "500"},
        headers=_auth(a),
    )
    assert res.status_code == 422
    assert res.json()["success"] is False
    a_list = client.get(_BASE, headers=_auth(a)).json()["data"]["items"]
    assert all(i["leadId"] != lb["id"] for i in a_list)


def test_filter_by_other_tenant_lead_exposes_nothing(client):
    a = _register(client, "filtla")
    b = _register(client, "filtlb")
    ca = _create_customer(client, a, "A Cust")
    cb = _create_customer(client, b, "B Cust")
    la = _create_lead(client, a, ca["id"])
    lb = _create_lead(client, b, cb["id"])
    _create_deal(client, a, la["id"], value="11")
    b_deal = _create_deal(client, b, lb["id"], value="22")

    res = client.get(_BASE, params={"leadId": lb["id"]}, headers=_auth(a))
    assert res.status_code == 200
    ids = {i["id"] for i in res.json()["data"]["items"]}
    assert b_deal["id"] not in ids
    assert ids == set() or all(
        i["companyId"] == a["user"]["companyId"]
        for i in res.json()["data"]["items"]
    )


def test_create_rejects_archived_lead(client):
    a = _register(client, "archlead")
    customer = _create_customer(client, a)
    lead = _create_lead(client, a, customer["id"])
    assert client.delete(f"{_LEADS}/{lead['id']}", headers=_auth(a)).status_code == 200

    res = client.post(
        _BASE,
        json={"leadId": lead["id"], "value": "50"},
        headers=_auth(a),
    )
    assert res.status_code == 422


def test_create_ignores_forged_company_id(client):
    a = _register(client, "forgeco")
    b = _register(client, "forgecob")
    ca = _create_customer(client, a, "A Co")
    lead = _create_lead(client, a, ca["id"])

    res = client.post(
        _BASE,
        json={
            "leadId": lead["id"],
            "value": "10",
            "companyId": b["user"]["companyId"],
            "company_id": b["user"]["companyId"],
        },
        headers=_auth(a),
    )
    assert res.status_code == 201, res.text
    assert res.json()["data"]["companyId"] == a["user"]["companyId"]


def test_update_does_not_accept_lead_id_reassignment(client):
    """DealUpdate schema omits leadId — reassignment is not supported."""
    a = _register(client, "noreassign")
    customer = _create_customer(client, a)
    lead1 = _create_lead(client, a, customer["id"], notes="one")
    lead2 = _create_lead(client, a, customer["id"], notes="two")
    deal = _create_deal(client, a, lead1["id"], value="10")

    res = client.patch(
        f"{_BASE}/{deal['id']}",
        json={"leadId": lead2["id"], "value": "11"},
        headers=_auth(a),
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["leadId"] == lead1["id"]
    assert float(data["value"]) == 11


# ---------------------------------------------------------------------------
# Mass assignment
# ---------------------------------------------------------------------------


def test_create_mass_assignment_protected_fields_ignored(client):
    a = _register(client, "massa")
    ca = _create_customer(client, a)
    lead = _create_lead(client, a, ca["id"])
    forged_id = str(uuid.uuid4())
    res = client.post(
        _BASE,
        json={
            "leadId": lead["id"],
            "value": "42",
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
    lead = _create_lead(client, a, ca["id"])
    created = _create_deal(client, a, lead["id"], value="10")
    original_id = created["id"]
    original_company = created["companyId"]

    res = client.patch(
        f"{_BASE}/{original_id}",
        json={
            "value": "20",
            "id": str(uuid.uuid4()),
            "companyId": str(uuid.uuid4()),
            "createdBy": str(uuid.uuid4()),
            "updatedBy": str(uuid.uuid4()),
            "deletedAt": "2020-01-01T00:00:00Z",
            "leadId": str(uuid.uuid4()),
        },
        headers=_auth(a),
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["id"] == original_id
    assert data["companyId"] == original_company
    assert float(data["value"]) == 20
    assert data["leadId"] == lead["id"]
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


def test_rbac_viewer_without_deals_cannot_mutate_or_read(client):
    owner = _register(client, "rbacown")
    customer = _create_customer(client, owner)
    lead = _create_lead(client, owner, customer["id"])
    deal = _create_deal(client, owner, lead["id"], value="5")

    _set_user_role(owner["user"]["id"], "Viewer")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )

    assert client.get(_BASE, headers=headers).status_code == 403
    assert client.get(f"{_BASE}/{deal['id']}", headers=headers).status_code == 403
    assert (
        client.post(
            _BASE,
            json={"leadId": lead["id"], "value": "1"},
            headers=headers,
        ).status_code
        == 403
    )


def test_rbac_employee_without_deals_cannot_access(client):
    """Employee seed grants leads.read but not deals.* — deals must 403."""
    owner = _register(client, "rbacemp")
    customer = _create_customer(client, owner)
    lead = _create_lead(client, owner, customer["id"])
    deal = _create_deal(client, owner, lead["id"], value="5")

    _set_user_role(owner["user"]["id"], "Employee")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )

    assert client.get(_BASE, headers=headers).status_code == 403
    assert client.get(f"{_BASE}/{deal['id']}", headers=headers).status_code == 403
    assert (
        client.post(
            _BASE,
            json={"leadId": lead["id"], "value": "1"},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{_BASE}/{deal['id']}",
            json={"value": "9"},
            headers=headers,
        ).status_code
        == 403
    )
    assert client.delete(f"{_BASE}/{deal['id']}", headers=headers).status_code == 403


def test_rbac_manager_can_read_and_write_deals(client):
    """Manager seed includes deals.* — full CRUD allowed."""
    owner = _register(client, "rbacmgr")
    customer = _create_customer(client, owner)
    lead = _create_lead(client, owner, customer["id"])
    lead2 = _create_lead(client, owner, customer["id"], notes="second")
    deal = _create_deal(client, owner, lead["id"], value="5")

    _set_user_role(owner["user"]["id"], "Manager")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )

    assert client.get(_BASE, headers=headers).status_code == 200
    assert client.get(f"{_BASE}/{deal['id']}", headers=headers).status_code == 200
    created = client.post(
        _BASE,
        json={"leadId": lead2["id"], "value": "15"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    patched = client.patch(
        f"{_BASE}/{deal['id']}",
        json={"status": "won"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert client.delete(f"{_BASE}/{created.json()['data']['id']}", headers=headers).status_code == 200


def test_unauthenticated_deals_rejected(client):
    assert client.get(_BASE).status_code == 401
    assert (
        client.post(
            _BASE,
            json={"leadId": str(uuid.uuid4()), "value": "1"},
        ).status_code
        == 401
    )


# ---------------------------------------------------------------------------
# Pagination / sort / filter / validation / soft delete / audit / OpenAPI
# ---------------------------------------------------------------------------


def test_pagination_meta(client):
    a = _register(client, "page")
    customer = _create_customer(client, a)
    for i in range(5):
        lead = _create_lead(client, a, customer["id"], notes=f"L{i}")
        _create_deal(client, a, lead["id"], value=str(100 + i))

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
    for value in ("100", "500"):
        lead = _create_lead(client, a, customer["id"], notes=value)
        _create_deal(client, a, lead["id"], value=value)

    asc = client.get(
        _BASE,
        params={"sortBy": "value", "sortDesc": False, "pageSize": 50},
        headers=_auth(a),
    )
    assert asc.status_code == 200
    values = [float(i["value"]) for i in asc.json()["data"]["items"]]
    assert values == sorted(values)

    status_sort = client.get(
        _BASE, params={"sortBy": "status", "sortDesc": False}, headers=_auth(a)
    )
    assert status_sort.status_code == 200

    bad = client.get(_BASE, params={"sortBy": "password_hash"}, headers=_auth(a))
    assert bad.status_code == 422


def test_lead_and_status_filters(client):
    a = _register(client, "filt")
    customer = _create_customer(client, a)
    l1 = _create_lead(client, a, customer["id"], notes="one")
    l2 = _create_lead(client, a, customer["id"], notes="two")
    d1 = _create_deal(client, a, l1["id"], value="10", status="open")
    d2 = _create_deal(client, a, l2["id"], value="20", status="won")

    by_lead = client.get(_BASE, params={"leadId": l1["id"]}, headers=_auth(a))
    ids = {i["id"] for i in by_lead.json()["data"]["items"]}
    assert d1["id"] in ids
    assert d2["id"] not in ids

    by_status = client.get(_BASE, params={"status": "won"}, headers=_auth(a))
    status_ids = {i["id"] for i in by_status.json()["data"]["items"]}
    assert d2["id"] in status_ids
    assert d1["id"] not in status_ids


def test_create_validation_errors(client):
    a = _register(client, "val")
    customer = _create_customer(client, a)
    lead = _create_lead(client, a, customer["id"])

    missing = client.post(_BASE, json={}, headers=_auth(a))
    assert missing.status_code == 422

    no_lead = client.post(_BASE, json={"value": "10"}, headers=_auth(a))
    assert no_lead.status_code == 422

    bad_status = client.post(
        _BASE,
        json={"leadId": lead["id"], "value": "10", "status": "pending"},
        headers=_auth(a),
    )
    assert bad_status.status_code == 422

    unknown_lead = client.post(
        _BASE,
        json={"leadId": str(uuid.uuid4()), "value": "10"},
        headers=_auth(a),
    )
    assert unknown_lead.status_code == 422


def test_deal_value_non_negative(client):
    a = _register(client, "dealval")
    customer = _create_customer(client, a)
    lead = _create_lead(client, a, customer["id"])

    positive = client.post(
        _BASE,
        json={"leadId": lead["id"], "value": "25000.50"},
        headers=_auth(a),
    )
    assert positive.status_code == 201, positive.text
    assert float(positive.json()["data"]["value"]) == 25000.50

    customer2 = _create_customer(client, a, name="Other Co")
    lead2 = _create_lead(client, a, customer2["id"])
    zero = client.post(
        _BASE,
        json={"leadId": lead2["id"], "value": "0"},
        headers=_auth(a),
    )
    assert zero.status_code == 201, zero.text
    assert float(zero.json()["data"]["value"]) == 0

    customer3 = _create_customer(client, a, name="Third Co")
    lead3 = _create_lead(client, a, customer3["id"])
    negative = client.post(
        _BASE,
        json={"leadId": lead3["id"], "value": "-1"},
        headers=_auth(a),
    )
    assert negative.status_code == 422

    negative_update = client.patch(
        f"{_BASE}/{positive.json()['data']['id']}",
        json={"value": "-0.01"},
        headers=_auth(a),
    )
    assert negative_update.status_code == 422


def test_soft_delete_sets_deleted_at(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import Deal

    a = _register(client, "softdel")
    customer = _create_customer(client, a)
    lead = _create_lead(client, a, customer["id"])
    created = _create_deal(client, a, lead["id"], value="7")
    assert client.delete(f"{_BASE}/{created['id']}", headers=_auth(a)).status_code == 200

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                row = (
                    await db.execute(
                        select(Deal).where(Deal.id == uuid.UUID(created["id"]))
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
    lead = _create_lead(client, a, customer["id"])
    created = _create_deal(client, a, lead["id"], value="8")
    client.patch(
        f"{_BASE}/{created['id']}",
        json={"status": "lost", "lostReason": "Budget"},
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
                                AuditLog.entity == "deals",
                                AuditLog.entity_id == uuid.UUID(created["id"]),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                assert "deal.created" in actions
                assert "deal.updated" in actions
                assert "deal.archived" in actions
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
    lb = _create_lead(client, b, cb["id"])
    b_deal = _create_deal(client, b, lb["id"], value="3")

    assert client.delete(f"{_BASE}/{b_deal['id']}", headers=_auth(a)).status_code == 404

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
                            AuditLog.action == "deal.archived",
                            AuditLog.entity_id == uuid.UUID(b_deal["id"]),
                            AuditLog.company_id
                            == uuid.UUID(a["user"]["companyId"]),
                        )
                    )
                ).scalar_one()
                assert count == 0
        finally:
            await engine.dispose()

    asyncio.run(_check())


def test_openapi_includes_deal_routes_without_writable_system_fields(client):
    res = client.get("/openapi.json")
    assert res.status_code == 200
    spec = res.json()
    paths = spec["paths"]
    assert "/api/v1/crm/deals" in paths
    assert "/api/v1/crm/deals/{deal_id}" in paths

    collection = paths["/api/v1/crm/deals"]
    assert set(collection.keys()) >= {"get", "post"}
    detail = paths["/api/v1/crm/deals/{deal_id}"]
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
    assert "leadId" in props
    assert "value" in props
    assert "currency" in props
    assert "status" in props

    # DealUpdate must not expose leadId reassignment
    patch_body = detail["patch"]["requestBody"]["content"]["application/json"]["schema"]
    patch_schema = patch_body
    if "$ref" in patch_schema:
        ref = patch_schema["$ref"].split("/")[-1]
        patch_schema = spec["components"]["schemas"][ref]
    patch_props = patch_schema.get("properties", {})
    assert "leadId" not in patch_props
    assert "lead_id" not in patch_props
