"""Part 08.2 — Invoices API: lifecycle, Decimal totals, RBAC, tenant isolation."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

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
_EMAIL_DOMAIN = "invoicesapitest.example.com"
_CUSTOMERS = "/api/v1/crm/customers"
_BASE = "/api/v1/finance/invoices"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "InvoicesApi1234"
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


def _create_customer(client: TestClient, session: dict, name: str = "Invoice Customer") -> dict:
    res = client.post(
        _CUSTOMERS,
        json={"companyName": name, "status": "active"},
        headers=_auth(session),
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def _invoice_payload(customer_id: str, **overrides) -> dict:
    today = date.today()
    body = {
        "invoiceNumber": overrides.pop("invoiceNumber", f"INV-{os.urandom(3).hex()}"),
        "customerId": customer_id,
        "issueDate": overrides.pop("issueDate", today.isoformat()),
        "dueDate": overrides.pop("dueDate", (today + timedelta(days=30)).isoformat()),
        "currency": overrides.pop("currency", "USD"),
        "tax": overrides.pop("tax", "10.00"),
        "items": overrides.pop(
            "items",
            [
                {"description": "Widget", "quantity": "2", "unitPrice": "50.00"},
                {"description": "Service fee", "quantity": "1", "unitPrice": "25.50"},
            ],
        ),
    }
    body.update(overrides)
    return body


def _create_invoice(client: TestClient, session: dict, customer_id: str, **overrides) -> dict:
    res = client.post(
        _BASE,
        json=_invoice_payload(customer_id, **overrides),
        headers=_auth(session),
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


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


def _insert_completed_payment(invoice_id: str, company_id: str) -> None:
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models.enums import PaymentMethod, PaymentSource, PaymentStatus
    from app.models.finance import Payment

    async def _run():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                db.add(
                    Payment(
                        company_id=uuid.UUID(company_id),
                        invoice_id=uuid.UUID(invoice_id),
                        payment_method=PaymentMethod.BANK_TRANSFER,
                        amount=Decimal("50.00"),
                        payment_date=date.today(),
                        status=PaymentStatus.COMPLETED,
                        currency="USD",
                        source=PaymentSource.MANUAL,
                        confirmed_at=datetime.now(UTC),
                    )
                )
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())


@pytest.fixture(scope="module", autouse=True)
def _cleanup_module_data():
    yield
    import asyncio

    from sqlalchemy import delete, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import AuditLog, AuthToken, Company, Customer, Role, Session, User, role_permissions, user_roles
    from app.models.finance import Invoice, InvoiceItem, Payment

    async def _run():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
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
                await db.execute(delete(Payment).where(Payment.company_id.in_(company_ids)))
                await db.execute(delete(InvoiceItem).where(InvoiceItem.company_id.in_(company_ids)))
                await db.execute(delete(Invoice).where(Invoice.company_id.in_(company_ids)))
                await db.execute(delete(Customer).where(Customer.company_id.in_(company_ids)))
                await db.execute(delete(AuditLog).where(AuditLog.company_id.in_(company_ids)))
            if user_ids:
                await db.execute(delete(Session).where(Session.user_id.in_(user_ids)))
                await db.execute(delete(AuthToken).where(AuthToken.user_id.in_(user_ids)))
                await db.execute(user_roles.delete().where(user_roles.c.user_id.in_(user_ids)))
            if role_ids:
                await db.execute(
                    role_permissions.delete().where(role_permissions.c.role_id.in_(role_ids))
                )
                await db.execute(delete(Role).where(Role.id.in_(role_ids)))
            if user_ids:
                await db.execute(delete(User).where(User.id.in_(user_ids)))
            if company_ids:
                await db.execute(delete(Company).where(Company.id.in_(company_ids)))
            await db.commit()
        await engine.dispose()

    asyncio.run(_run())


def test_create_invoice_computes_decimal_totals(client):
    owner = _register(client, "create-totals")
    customer = _create_customer(client, owner, "Decimal Customer")
    created = _create_invoice(client, owner, customer["id"], tax="10.00")

    assert created["customerName"] == "Decimal Customer"
    assert created["subtotal"] == "125.50"
    assert created["tax"] == "10.00"
    assert created["total"] == "135.50"
    assert len(created["items"]) == 2
    assert created["items"][0]["total"] == "100.00"
    assert created["items"][1]["total"] == "25.50"
    assert created["status"] == "draft"
    assert created["amountPaid"] == "0.00"
    assert created["outstandingBalance"] == "135.50"


def test_send_invoice_sets_sent_at(client):
    owner = _register(client, "send")
    customer = _create_customer(client, owner, "Send Customer")
    created = _create_invoice(client, owner, customer["id"])

    res = client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["customerName"] == "Send Customer"
    assert body["status"] == "sent"
    assert body["sentAt"] is not None


def test_cannot_update_sent_invoice(client):
    owner = _register(client, "sent-lock")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])
    client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))

    res = client.patch(
        f"{_BASE}/{created['id']}",
        json={"tax": "99.00"},
        headers=_auth(owner),
    )
    assert res.status_code == 409


def test_void_draft_invoice(client):
    owner = _register(client, "void-draft")
    customer = _create_customer(client, owner, "Void Customer")
    created = _create_invoice(client, owner, customer["id"])

    res = client.post(f"{_BASE}/{created['id']}/void", headers=_auth(owner))
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["customerName"] == "Void Customer"
    assert body["status"] == "void"
    assert body["voidedAt"] is not None


def test_void_sent_without_payments(client):
    owner = _register(client, "void-sent")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])
    client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))

    res = client.post(f"{_BASE}/{created['id']}/void", headers=_auth(owner))
    assert res.status_code == 200, res.text
    assert res.json()["data"]["status"] == "void"


def test_cannot_void_sent_with_completed_payments(client):
    owner = _register(client, "void-blocked")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])
    client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))
    _insert_completed_payment(created["id"], created["companyId"])

    res = client.post(f"{_BASE}/{created['id']}/void", headers=_auth(owner))
    assert res.status_code == 409


def test_cross_tenant_customer_rejected(client):
    owner_a = _register(client, "tenant-a")
    owner_b = _register(client, "tenant-b")
    customer_b = _create_customer(client, owner_b, "Other Co")

    res = client.post(
        _BASE,
        json=_invoice_payload(customer_b["id"]),
        headers=_auth(owner_a),
    )
    assert res.status_code == 422


def test_cross_tenant_invoice_not_found(client):
    owner_a = _register(client, "iso-a")
    owner_b = _register(client, "iso-b")
    customer = _create_customer(client, owner_b, "Tenant B Customer")
    created = _create_invoice(client, owner_b, customer["id"])
    assert created["customerName"] == "Tenant B Customer"

    res = client.get(f"{_BASE}/{created['id']}", headers=_auth(owner_a))
    assert res.status_code == 404
    assert res.json()["data"] is None


def test_rbac_manager_can_read_not_create(client):
    owner = _register(client, "rbac-mgr")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])

    _set_user_role(owner["user"]["id"], "Manager")

    read_res = client.get(f"{_BASE}/{created['id']}", headers=_auth(owner))
    assert read_res.status_code == 200

    create_res = client.post(
        _BASE,
        json=_invoice_payload(customer["id"]),
        headers=_auth(owner),
    )
    assert create_res.status_code == 403


def test_rbac_manager_cannot_send(client):
    owner = _register(client, "rbac-send")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])
    _set_user_role(owner["user"]["id"], "Manager")

    res = client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))
    assert res.status_code == 403


def test_update_draft_recalculates_totals(client):
    owner = _register(client, "update-draft")
    customer = _create_customer(client, owner, "Updated Invoice Customer")
    created = _create_invoice(client, owner, customer["id"])

    res = client.patch(
        f"{_BASE}/{created['id']}",
        json={
            "tax": "5.00",
            "items": [{"description": "Updated line", "quantity": "3", "unitPrice": "10.00"}],
        },
        headers=_auth(owner),
    )
    assert res.status_code == 200, res.text
    body = res.json()["data"]
    assert body["customerName"] == "Updated Invoice Customer"
    assert body["subtotal"] == "30.00"
    assert body["tax"] == "5.00"
    assert body["total"] == "35.00"


def test_archive_draft_only(client):
    owner = _register(client, "archive")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])
    client.post(f"{_BASE}/{created['id']}/send", headers=_auth(owner))

    res = client.delete(f"{_BASE}/{created['id']}", headers=_auth(owner))
    assert res.status_code == 409


def test_create_invoice_audit_logged(client):
    owner = _register(client, "audit")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])

    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import AuditLog

    async def _fetch():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                row = (
                    await db.execute(
                        select(AuditLog).where(
                            AuditLog.entity == "invoices",
                            AuditLog.entity_id == uuid.UUID(created["id"]),
                            AuditLog.action == "invoice.created",
                        )
                    )
                ).scalar_one_or_none()
                return row
        finally:
            await engine.dispose()

    audit = asyncio.run(_fetch())
    assert audit is not None


def test_duplicate_invoice_number_rejected(client):
    owner = _register(client, "dup-num")
    customer = _create_customer(client, owner)
    number = f"DUP-{os.urandom(2).hex()}"
    _create_invoice(client, owner, customer["id"], invoiceNumber=number)

    res = client.post(
        _BASE,
        json=_invoice_payload(customer["id"], invoiceNumber=number),
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_list_invoices_by_customer(client):
    owner = _register(client, "list-filter")
    customer_a = _create_customer(client, owner, "Alpha")
    customer_b = _create_customer(client, owner, "Beta")
    _create_invoice(client, owner, customer_a["id"])
    _create_invoice(client, owner, customer_b["id"])

    res = client.get(
        _BASE,
        params={"customerId": customer_a["id"]},
        headers=_auth(owner),
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["meta"]["total"] == 1
    assert data["items"][0]["customerId"] == customer_a["id"]
    assert data["items"][0]["customerName"] == "Alpha"


def test_invoice_detail_returns_current_customer_name(client):
    owner = _register(client, "detail-customer-name")
    customer = _create_customer(client, owner, "Before Rename")
    created = _create_invoice(client, owner, customer["id"])

    rename_res = client.patch(
        f"{_CUSTOMERS}/{customer['id']}",
        json={"companyName": "After Rename"},
        headers=_auth(owner),
    )
    assert rename_res.status_code == 200, rename_res.text

    detail_res = client.get(f"{_BASE}/{created['id']}", headers=_auth(owner))
    assert detail_res.status_code == 200, detail_res.text
    assert detail_res.json()["data"]["customerName"] == "After Rename"


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"items": [{"description": "Invalid", "quantity": "-1", "unitPrice": "1"}]}, "body.items.0.quantity"),
        ({"items": [{"description": "Invalid", "quantity": "1", "unitPrice": "-1"}]}, "body.items.0.unitPrice"),
        ({"tax": "-1"}, "body.tax"),
    ],
)
def test_create_rejects_negative_money_with_validation_error(client, override, field):
    owner = _register(client, f"create-negative-{field.rsplit('.', 1)[-1]}")
    customer = _create_customer(client, owner)

    res = client.post(
        _BASE,
        json=_invoice_payload(customer["id"], **override),
        headers=_auth(owner),
    )

    assert res.status_code == 422, res.text
    assert res.json()["errors"][0]["code"] == "validation_error"
    assert res.json()["errors"][0]["field"] == field


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"items": [{"description": "Invalid", "quantity": "-1", "unitPrice": "1"}]}, "body.items.0.quantity"),
        ({"items": [{"description": "Invalid", "quantity": "1", "unitPrice": "-1"}]}, "body.items.0.unitPrice"),
        ({"tax": "-1"}, "body.tax"),
    ],
)
def test_update_rejects_negative_money_with_validation_error(client, payload, field):
    owner = _register(client, f"update-negative-{field.rsplit('.', 1)[-1]}")
    customer = _create_customer(client, owner)
    created = _create_invoice(client, owner, customer["id"])

    res = client.patch(
        f"{_BASE}/{created['id']}",
        json=payload,
        headers=_auth(owner),
    )

    assert res.status_code == 422, res.text
    assert res.json()["errors"][0]["code"] == "validation_error"
    assert res.json()["errors"][0]["field"] == field


def test_zero_money_values_remain_valid_for_create_and_update(client):
    owner = _register(client, "zero-money")
    customer = _create_customer(client, owner, "Zero Customer")
    created = _create_invoice(
        client,
        owner,
        customer["id"],
        tax="0",
        items=[{"description": "Free", "quantity": "0", "unitPrice": "0"}],
    )

    assert created["subtotal"] == "0.00"
    assert created["tax"] == "0.00"
    assert created["total"] == "0.00"

    update_res = client.patch(
        f"{_BASE}/{created['id']}",
        json={
            "tax": "0",
            "items": [{"description": "Still free", "quantity": "0", "unitPrice": "0"}],
        },
        headers=_auth(owner),
    )
    assert update_res.status_code == 200, update_res.text
    assert update_res.json()["data"]["total"] == "0.00"
