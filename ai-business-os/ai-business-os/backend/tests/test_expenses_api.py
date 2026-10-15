"""Expenses API — integration tests.

Covers: CRUD, validation, permissions, tenant isolation, soft-delete,
date filters, paid_by cross-tenant rejection.
Requires a running PostgreSQL database. Skip with SKIP_DB_TESTS=1.
"""
from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.main import app  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
_EMAIL_DOMAIN = "expensesapitest.example.com"
_EXPENSES = "/api/v1/finance/expenses"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "Expenses1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"ExpCo {tag}",
            "firstName": "Exp",
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


def _make_expense(
    client: TestClient,
    headers: dict,
    *,
    category: str = "Travel",
    amount: str = "42.50",
    currency: str = "USD",
    description: str | None = "Taxi",
    expense_date: date | None = None,
    paid_by: str | None = None,
) -> dict:
    payload: dict = {
        "category": category,
        "amount": amount,
        "currency": currency,
        "date": (expense_date or date.today()).isoformat(),
    }
    if description is not None:
        payload["description"] = description
    if paid_by is not None:
        payload["paidBy"] = paid_by
    res = client.post(_EXPENSES, headers=headers, json=payload)
    assert res.status_code == 201, res.text
    return res.json()["data"]


# ---------------------------------------------------------------------------
# Auth / permissions
# ---------------------------------------------------------------------------


def test_list_unauthenticated_returns_401(client: TestClient):
    assert client.get(_EXPENSES).status_code == 401


def test_owner_can_crud_expense(client: TestClient):
    auth = _register(client, "crud")
    created = _make_expense(client, auth["headers"], amount="15.00")
    assert created["category"] == "Travel"
    assert created["amount"] == "15.00"
    assert created["currency"] == "USD"
    expense_id = created["id"]

    get_res = client.get(f"{_EXPENSES}/{expense_id}", headers=auth["headers"])
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == expense_id

    patch_res = client.patch(
        f"{_EXPENSES}/{expense_id}",
        headers=auth["headers"],
        json={"category": "Meals", "amount": "18.75"},
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["data"]["category"] == "Meals"
    assert patch_res.json()["data"]["amount"] == "18.75"

    delete_res = client.delete(f"{_EXPENSES}/{expense_id}", headers=auth["headers"])
    assert delete_res.status_code == 200

    gone = client.get(f"{_EXPENSES}/{expense_id}", headers=auth["headers"])
    assert gone.status_code == 404


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_create_rejects_zero_and_negative_amount(client: TestClient):
    auth = _register(client, "amt")
    for bad in ("0", "0.00", "-5.00"):
        res = client.post(
            _EXPENSES,
            headers=auth["headers"],
            json={
                "category": "Office",
                "amount": bad,
                "currency": "USD",
                "date": date.today().isoformat(),
            },
        )
        assert res.status_code == 422, res.text


def test_create_rejects_invalid_currency(client: TestClient):
    auth = _register(client, "cur")
    res = client.post(
        _EXPENSES,
        headers=auth["headers"],
        json={
            "category": "Office",
            "amount": "10.00",
            "currency": "US",
            "date": date.today().isoformat(),
        },
    )
    assert res.status_code == 422


def test_create_rejects_blank_category(client: TestClient):
    auth = _register(client, "cat")
    res = client.post(
        _EXPENSES,
        headers=auth["headers"],
        json={
            "category": "   ",
            "amount": "10.00",
            "currency": "USD",
            "date": date.today().isoformat(),
        },
    )
    assert res.status_code == 422


def test_update_with_empty_body_rejected(client: TestClient):
    auth = _register(client, "empty-patch")
    created = _make_expense(client, auth["headers"])
    res = client.patch(
        f"{_EXPENSES}/{created['id']}",
        headers=auth["headers"],
        json={},
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# List / filters
# ---------------------------------------------------------------------------


def test_list_empty_tenant(client: TestClient):
    auth = _register(client, "empty")
    res = client.get(_EXPENSES, headers=auth["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["items"] == []
    assert data["meta"]["total"] == 0


def test_list_filters_by_category_and_date(client: TestClient):
    auth = _register(client, "filters")
    today = date.today()
    _make_expense(
        client, auth["headers"], category="Travel", expense_date=today, amount="10.00"
    )
    _make_expense(
        client,
        auth["headers"],
        category="Meals",
        expense_date=today - timedelta(days=10),
        amount="20.00",
    )

    by_cat = client.get(
        _EXPENSES, headers=auth["headers"], params={"category": "Travel"}
    )
    assert by_cat.status_code == 200
    items = by_cat.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["category"] == "Travel"

    by_date = client.get(
        _EXPENSES,
        headers=auth["headers"],
        params={"dateFrom": today.isoformat(), "dateTo": today.isoformat()},
    )
    assert by_date.status_code == 200
    assert len(by_date.json()["data"]["items"]) == 1


def test_list_rejects_inverted_date_range(client: TestClient):
    auth = _register(client, "daterange")
    today = date.today()
    res = client.get(
        _EXPENSES,
        headers=auth["headers"],
        params={
            "dateFrom": today.isoformat(),
            "dateTo": (today - timedelta(days=1)).isoformat(),
        },
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# paid_by validation + tenant isolation
# ---------------------------------------------------------------------------


def test_paid_by_self_accepted(client: TestClient):
    auth = _register(client, "paidby-self")
    user_id = auth["user"]["id"]
    created = _make_expense(client, auth["headers"], paid_by=user_id)
    assert created["paidBy"] == user_id


def test_paid_by_cross_tenant_rejected(client: TestClient):
    auth_a = _register(client, "paidby-a")
    auth_b = _register(client, "paidby-b")
    other_user = auth_b["user"]["id"]

    res = client.post(
        _EXPENSES,
        headers=auth_a["headers"],
        json={
            "category": "Travel",
            "amount": "10.00",
            "currency": "USD",
            "date": date.today().isoformat(),
            "paidBy": other_user,
        },
    )
    assert res.status_code == 422, res.text


def test_tenant_isolation_list_and_get(client: TestClient):
    auth_a = _register(client, "iso-a")
    auth_b = _register(client, "iso-b")
    created = _make_expense(client, auth_a["headers"])

    list_b = client.get(_EXPENSES, headers=auth_b["headers"])
    assert list_b.json()["data"]["meta"]["total"] == 0

    get_b = client.get(f"{_EXPENSES}/{created['id']}", headers=auth_b["headers"])
    assert get_b.status_code == 404

    patch_b = client.patch(
        f"{_EXPENSES}/{created['id']}",
        headers=auth_b["headers"],
        json={"category": "Hacked"},
    )
    assert patch_b.status_code == 404

    delete_b = client.delete(f"{_EXPENSES}/{created['id']}", headers=auth_b["headers"])
    assert delete_b.status_code == 404


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
                            Role.is_system.is_(True),
                        )
                    )
                ).scalar_one()
                user.roles = [role]
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())


def test_manager_denied_all_expense_ops(client: TestClient):
    """Managers keep invoices.read but must not receive expenses.*."""
    auth = _register(client, "mgr-deny")
    created = _make_expense(client, auth["headers"])
    _set_user_role(auth["user"]["id"], "Manager")

    assert client.get(_EXPENSES, headers=auth["headers"]).status_code == 403
    assert (
        client.get(f"{_EXPENSES}/{created['id']}", headers=auth["headers"]).status_code
        == 403
    )
    assert (
        client.post(
            _EXPENSES,
            headers=auth["headers"],
            json={
                "category": "X",
                "amount": "1.00",
                "currency": "USD",
                "date": date.today().isoformat(),
            },
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{_EXPENSES}/{created['id']}",
            headers=auth["headers"],
            json={"category": "Y"},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"{_EXPENSES}/{created['id']}", headers=auth["headers"]
        ).status_code
        == 403
    )


def test_category_filter_is_case_insensitive(client: TestClient):
    auth = _register(client, "cat-case")
    _make_expense(client, auth["headers"], category="Travel")

    for cat in ("Travel", "travel", "TRAVEL", "TrAvEl"):
        res = client.get(_EXPENSES, headers=auth["headers"], params={"category": cat})
        assert res.status_code == 200, res.text
        assert res.json()["data"]["meta"]["total"] == 1
        assert res.json()["data"]["items"][0]["category"] == "Travel"

    miss = client.get(
        _EXPENSES, headers=auth["headers"], params={"category": "Meals"}
    )
    assert miss.json()["data"]["meta"]["total"] == 0


def test_search_matches_description(client: TestClient):
    auth = _register(client, "search-desc")
    _make_expense(
        client,
        auth["headers"],
        description="airport cab",
        category="Travel",
    )
    res = client.get(
        _EXPENSES, headers=auth["headers"], params={"search": "airport"}
    )
    assert res.status_code == 200
    assert res.json()["data"]["meta"]["total"] == 1


def test_invalid_sort_field_rejected(client: TestClient):
    auth = _register(client, "bad-sort")
    res = client.get(
        _EXPENSES, headers=auth["headers"], params={"sortBy": "hack;drop"}
    )
    assert res.status_code == 422


def test_soft_deleted_excluded_from_list(client: TestClient):
    auth = _register(client, "soft-list")
    created = _make_expense(client, auth["headers"])
    assert (
        client.delete(
            f"{_EXPENSES}/{created['id']}", headers=auth["headers"]
        ).status_code
        == 200
    )
    listed = client.get(_EXPENSES, headers=auth["headers"])
    assert listed.json()["data"]["meta"]["total"] == 0
    assert (
        client.get(
            f"{_EXPENSES}/{created['id']}", headers=auth["headers"]
        ).status_code
        == 404
    )


def test_paid_by_unknown_uuid_rejected(client: TestClient):
    auth = _register(client, "paidby-unknown")
    res = client.post(
        _EXPENSES,
        headers=auth["headers"],
        json={
            "category": "Travel",
            "amount": "10.00",
            "currency": "USD",
            "date": date.today().isoformat(),
            "paidBy": str(uuid.uuid4()),
        },
    )
    assert res.status_code == 422, res.text
