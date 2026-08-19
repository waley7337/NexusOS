"""Part 08.4.2 Payments HTTP API contract and idempotency coverage."""
from __future__ import annotations

import asyncio
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import NullPool

from app.main import app
from app.models import AuditLog, AuthToken, Company, Customer, Role, Session, User
from app.models.enums import InvoiceStatus, PaymentStatus
from app.models.finance import Invoice, InvoiceItem, Payment
from app.models.payments import IdempotencyRecord
from app.models.user import role_permissions, user_roles
from app.payments.idempotency import execute_idempotent
from app.repositories.payments import PaymentRepository

TEST_DB = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ.get("DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"),
)
_EMAIL_DOMAIN = "paymentsapitest.example.com"
_CUSTOMERS = "/api/v1/crm/customers"
_INVOICES = "/api/v1/finance/invoices"


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module", autouse=True)
def cleanup_module_data():
    yield

    async def run() -> None:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                user_ids = list(
                    (
                        await db.scalars(
                            select(User.id).where(User.email.like(f"%@{_EMAIL_DOMAIN}"))
                        )
                    ).all()
                )
                company_ids = (
                    list(
                        (
                            await db.scalars(
                                select(User.company_id).where(User.id.in_(user_ids))
                            )
                        ).all()
                    )
                    if user_ids
                    else []
                )
                role_ids = (
                    list(
                        (
                            await db.scalars(
                                select(Role.id).where(Role.company_id.in_(company_ids))
                            )
                        ).all()
                    )
                    if company_ids
                    else []
                )
                if company_ids:
                    await db.execute(delete(IdempotencyRecord).where(IdempotencyRecord.company_id.in_(company_ids)))
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
                    await db.execute(role_permissions.delete().where(role_permissions.c.role_id.in_(role_ids)))
                    await db.execute(delete(Role).where(Role.id.in_(role_ids)))
                if user_ids:
                    await db.execute(delete(User).where(User.id.in_(user_ids)))
                if company_ids:
                    await db.execute(delete(Company).where(Company.id.in_(company_ids)))
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(run())


def _register(client: TestClient, tag: str) -> dict:
    email = f"{tag}-{uuid.uuid4().hex}@{_EMAIL_DOMAIN}"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"Payment {tag}",
            "firstName": "Pay",
            "lastName": "Tester",
            "email": email,
            "password": "PaymentsApi1234",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    return {
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
        "user": data["user"],
    }


def _customer(client: TestClient, session: dict) -> dict:
    response = client.post(
        _CUSTOMERS,
        headers=session["headers"],
        json={"companyName": "Payment Customer", "status": "active"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _invoice(
    client: TestClient,
    session: dict,
    customer_id: str,
    *,
    total: str = "100.00",
    send: bool = True,
) -> dict:
    today = date.today()
    response = client.post(
        _INVOICES,
        headers=session["headers"],
        json={
            "invoiceNumber": f"PAY-{uuid.uuid4().hex[:10]}",
            "customerId": customer_id,
            "issueDate": today.isoformat(),
            "dueDate": (today + timedelta(days=30)).isoformat(),
            "currency": "USD",
            "tax": "0.00",
            "items": [{"description": "Payment test", "quantity": "1", "unitPrice": total}],
        },
    )
    assert response.status_code == 201, response.text
    invoice = response.json()["data"]
    if send:
        response = client.post(f"{_INVOICES}/{invoice['id']}/send", headers=session["headers"])
        assert response.status_code == 200, response.text
        invoice = response.json()["data"]
    return invoice


def _record_body(amount: object = "25.00", **overrides: object) -> dict:
    body = {
        "amount": amount,
        "currency": "USD",
        "paymentDate": date.today().isoformat(),
        "paymentMethod": "bank_transfer",
        "notes": None,
    }
    body.update(overrides)
    return body


def _payment_url(invoice_id: str) -> str:
    return f"{_INVOICES}/{invoice_id}/payments"


def _headers(session: dict, key: str) -> dict:
    return {**session["headers"], "Idempotency-Key": key}


def _set_role(user_id: str, role_name: str) -> None:
    async def run() -> None:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                user = (
                    await db.execute(
                        select(User).where(User.id == uuid.UUID(user_id)).options(selectinload(User.roles))
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

    asyncio.run(run())


def _counts(company_id: str) -> tuple[int, int, int]:
    async def run() -> tuple[int, int, int]:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                company = uuid.UUID(company_id)
                return (
                    int(await db.scalar(select(func.count()).select_from(Payment).where(Payment.company_id == company)) or 0),
                    int(await db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.company_id == company, AuditLog.action.in_(("payment.recorded", "payment.refunded")))) or 0),
                    int(await db.scalar(select(func.count()).select_from(IdempotencyRecord).where(IdempotencyRecord.company_id == company)) or 0),
                )
        finally:
            await engine.dispose()

    return asyncio.run(run())


def _set_inactive(model: type[Invoice] | type[Payment], entity_id: str) -> None:
    async def run() -> None:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                await db.execute(
                    update(model)
                    .where(model.id == uuid.UUID(entity_id))
                    .values(is_active=False)
                )
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(run())


def _financial_state(invoice_id: str, payment_id: str | None = None) -> tuple:
    async def run() -> tuple:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                invoice_status = await db.scalar(
                    select(Invoice.status).where(Invoice.id == uuid.UUID(invoice_id))
                )
                if payment_id is None:
                    return (invoice_status,)
                payment = (
                    await db.execute(
                        select(Payment.status, Payment.refunded_amount).where(
                            Payment.id == uuid.UUID(payment_id)
                        )
                    )
                ).one()
                return invoice_status, payment.status, payment.refunded_amount
        finally:
            await engine.dispose()

    return asyncio.run(run())


def _expire_or_incomplete(company_id: str, scope: str, key: str, *, expire: bool) -> None:
    async def run() -> None:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                row = (
                    await db.execute(
                        select(IdempotencyRecord).where(
                            IdempotencyRecord.company_id == uuid.UUID(company_id),
                            IdempotencyRecord.scope == scope,
                            IdempotencyRecord.idempotency_key == key,
                        )
                    )
                ).scalar_one()
                if expire:
                    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
                else:
                    row.result_entity_id = None
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(run())


def _set_result_failure_trigger(company_id: str, *, enabled: bool) -> None:
    async def run() -> None:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as db:
                await db.execute(text("DROP TRIGGER IF EXISTS test_fail_idempotency_result ON idempotency_records"))
                await db.execute(text("DROP FUNCTION IF EXISTS test_fail_idempotency_result()"))
                if enabled:
                    await db.execute(
                        text(
                            f"""
                            CREATE FUNCTION test_fail_idempotency_result() RETURNS trigger AS $$
                            BEGIN
                                IF NEW.company_id = '{uuid.UUID(company_id)}'
                                   AND NEW.result_entity_id IS NOT NULL THEN
                                    RAISE EXCEPTION 'forced idempotency result failure';
                                END IF;
                                RETURN NEW;
                            END;
                            $$ LANGUAGE plpgsql
                            """
                        )
                    )
                    await db.execute(
                        text(
                            "CREATE TRIGGER test_fail_idempotency_result "
                            "BEFORE UPDATE ON idempotency_records FOR EACH ROW "
                            "EXECUTE FUNCTION test_fail_idempotency_result()"
                        )
                    )
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_authentication_rbac_and_tenant_not_found(client):
    owner = _register(client, "auth-owner")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    assert client.get(_payment_url(invoice["id"])).status_code == 401
    _set_role(owner["user"]["id"], "Manager")
    assert client.get(_payment_url(invoice["id"]), headers=owner["headers"]).status_code == 403
    other = _register(client, "auth-other")
    response = client.get(_payment_url(invoice["id"]), headers=other["headers"])
    assert response.status_code == 404
    assert response.json()["errors"] == [{"code": "not_found"}]


def test_strict_money_response_reads_and_no_internal_leakage(client):
    owner = _register(client, "strict-money")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    url = _payment_url(invoice["id"])
    numeric = client.post(url, headers=_headers(owner, "numeric"), json=_record_body(25.00))
    assert numeric.status_code == 422
    assert numeric.json()["errors"][0]["field"] == "body.amount"

    created = client.post(url, headers=_headers(owner, "string"), json=_record_body("25.5"))
    assert created.status_code == 201, created.text
    payment = created.json()["data"]
    assert payment["amount"] == "25.50"
    assert payment["refundedAmount"] == "0.00"
    forbidden = {
        "companyId", "createdBy", "updatedBy", "confirmedBy", "refundedBy",
        "providerAccountId", "providerPaymentId", "providerCheckoutSessionId",
        "providerRefundId", "idempotencyKey", "failureCode", "failureMessage",
        "deletedAt", "isActive", "provider",
    }
    assert forbidden.isdisjoint(payment)
    detail = client.get(f"/api/v1/finance/payments/{payment['id']}", headers=owner["headers"])
    assert detail.status_code == 200
    listed = client.get(url, headers=owner["headers"])
    assert listed.status_code == 200
    assert listed.json()["data"]["items"][0]["id"] == payment["id"]
    assert listed.json()["data"]["meta"]["pageSize"] == 20
    assert client.get(f"{url}?pageSize=101", headers=owner["headers"]).status_code == 422

    maximum_invoice = _invoice(client, owner, _customer(client, owner)["id"], total="999999999999.99")
    maximum = client.post(
        _payment_url(maximum_invoice["id"]),
        headers=_headers(owner, "maximum"),
        json=_record_body("999999999999.99"),
    )
    assert maximum.status_code == 201, maximum.text
    assert maximum.json()["data"]["amount"] == "999999999999.99"


@pytest.mark.parametrize(
    "amount",
    ["NaN", "Infinity", "-1", "0", "1000000000000.00", "1e2", "1E2", "1e+2", "1e-2"],
)
def test_invalid_money_is_controlled_422(client, amount):
    owner = _register(client, f"invalid-{uuid.uuid4().hex[:6]}")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    response = client.post(
        _payment_url(invoice["id"]),
        headers=_headers(owner, f"bad-{uuid.uuid4()}"),
        json=_record_body(amount),
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "validation_error"


def test_refund_rejects_scientific_notation(client):
    owner = _register(client, "refund-notation")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    payment = client.post(
        _payment_url(invoice["id"]),
        headers=_headers(owner, "refund-notation-record"),
        json=_record_body("100.00"),
    ).json()["data"]
    refund_url = f"/api/v1/finance/payments/{payment['id']}/refund"
    for amount in ("1e2", "1E2", "1e+2", "1e-2"):
        response = client.post(
            refund_url,
            headers=_headers(owner, f"refund-notation-{amount}"),
            json={"amount": amount, "reason": "invalid notation"},
        )
        assert response.status_code == 422
        assert response.json()["errors"][0]["code"] == "validation_error"
    assert _financial_state(invoice["id"], payment["id"])[1:] == (
        PaymentStatus.COMPLETED,
        Decimal("0.00"),
    )


def test_inactive_invoice_cannot_accept_payment(client):
    owner = _register(client, "inactive-invoice")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    _set_inactive(Invoice, invoice["id"])

    response = client.post(
        _payment_url(invoice["id"]),
        headers=_headers(owner, "inactive-invoice-payment"),
        json=_record_body("25.00"),
    )

    assert response.status_code == 404
    assert response.json()["errors"] == [{"code": "not_found"}]
    assert _counts(owner["user"]["companyId"]) == (0, 0, 0)
    assert _financial_state(invoice["id"]) == (InvoiceStatus.SENT,)


def test_inactive_payment_cannot_be_refunded(client):
    owner = _register(client, "inactive-payment")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    payment = client.post(
        _payment_url(invoice["id"]),
        headers=_headers(owner, "inactive-payment-record"),
        json=_record_body("25.00"),
    ).json()["data"]
    before = _financial_state(invoice["id"], payment["id"])
    _set_inactive(Payment, payment["id"])

    response = client.post(
        f"/api/v1/finance/payments/{payment['id']}/refund",
        headers=_headers(owner, "inactive-payment-refund"),
        json={"amount": "5.00", "reason": "must not mutate"},
    )

    assert response.status_code == 404
    assert response.json()["errors"] == [{"code": "not_found"}]
    assert _counts(owner["user"]["companyId"]) == (1, 1, 1)
    assert _financial_state(invoice["id"], payment["id"]) == before


def test_payment_state_currency_balance_and_date_reasons(client):
    owner = _register(client, "reasons")
    customer = _customer(client, owner)
    draft = _invoice(client, owner, customer["id"], send=False)
    response = client.post(_payment_url(draft["id"]), headers=_headers(owner, "draft"), json=_record_body())
    assert response.status_code == 409
    assert response.json()["errors"][0]["reason"] == "invoice_not_payment_eligible"
    sent = _invoice(client, owner, customer["id"])
    currency = client.post(_payment_url(sent["id"]), headers=_headers(owner, "currency"), json=_record_body(currency="EUR"))
    assert currency.status_code == 422
    assert currency.json()["errors"][0]["reason"] == "payment_currency_mismatch"
    over = client.post(_payment_url(sent["id"]), headers=_headers(owner, "over"), json=_record_body("101.00"))
    assert over.status_code == 409
    assert over.json()["errors"][0]["reason"] == "payment_exceeds_invoice_balance"
    future = client.post(
        _payment_url(sent["id"]),
        headers=_headers(owner, "future"),
        json=_record_body(paymentDate=(date.today() + timedelta(days=1)).isoformat()),
    )
    assert future.status_code == 422
    assert future.json()["errors"][0]["reason"] == "payment_date_in_future"


def test_payment_and_refund_idempotency_audit_and_cross_tenant(client):
    owner = _register(client, "refund")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    url = _payment_url(invoice["id"])
    headers = _headers(owner, "record-once")
    first = client.post(url, headers=headers, json=_record_body("100.00"))
    replay = client.post(url, headers=headers, json=_record_body("100.0"))
    assert first.status_code == replay.status_code == 201
    payment = first.json()["data"]
    assert replay.json()["data"]["id"] == payment["id"]
    assert _counts(owner["user"]["companyId"]) == (1, 1, 1)
    changed = client.post(url, headers=headers, json=_record_body("99.00"))
    assert changed.status_code == 409
    assert changed.json()["errors"][0]["reason"] == "idempotency_key_reused"

    refund_url = f"/api/v1/finance/payments/{payment['id']}/refund"
    partial = client.post(refund_url, headers=_headers(owner, "refund-once"), json={"amount": "25.00", "reason": " correction "})
    repeat = client.post(refund_url, headers=_headers(owner, "refund-once"), json={"amount": "25.0", "reason": "correction"})
    assert partial.status_code == repeat.status_code == 200
    assert partial.json()["data"]["status"] == "completed"
    assert repeat.json()["data"]["refundedAmount"] == "25.00"
    assert _counts(owner["user"]["companyId"]) == (1, 2, 2)
    excessive = client.post(refund_url, headers=_headers(owner, "refund-too-much"), json={"amount": "76.00", "reason": "too much"})
    assert excessive.status_code == 409
    assert excessive.json()["errors"][0]["reason"] == "refund_exceeds_refundable_balance"
    full = client.post(refund_url, headers=_headers(owner, "refund-full"), json={"amount": "75.00", "reason": "full"})
    assert full.status_code == 200
    assert full.json()["data"]["status"] == "refunded"
    other = _register(client, "refund-other")
    assert client.get(f"/api/v1/finance/payments/{payment['id']}", headers=other["headers"]).status_code == 404
    assert client.post(refund_url, headers=_headers(other, "cross"), json={"amount": "1.00", "reason": "x"}).status_code == 404


def test_same_key_different_invoice_has_one_owner_under_real_postgres(client):
    owner = _register(client, "concurrent-invoices")
    customer = _customer(client, owner)
    invoices = [_invoice(client, owner, customer["id"]) for _ in range(2)]
    barrier = threading.Barrier(2)

    def post(invoice_id: str) -> tuple[int, dict]:
        barrier.wait()
        response = client.post(
            _payment_url(invoice_id),
            headers=_headers(owner, "shared-across-invoices"),
            json=_record_body("10.00"),
        )
        return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(post, [row["id"] for row in invoices]))
    assert sorted(status for status, _ in results) == [201, 409]
    conflict = next(body for status, body in results if status == 409)
    assert conflict["errors"][0]["reason"] == "idempotency_key_reused"
    assert _counts(owner["user"]["companyId"])[0] == 1


def test_concurrent_same_body_payment_and_refund_replay_once(client):
    owner = _register(client, "concurrent-replay")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    barrier = threading.Barrier(2)

    def record() -> tuple[int, dict]:
        barrier.wait()
        response = client.post(
            _payment_url(invoice["id"]),
            headers=_headers(owner, "concurrent-record"),
            json=_record_body("100.00"),
        )
        return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        recorded = list(pool.map(lambda _: record(), range(2)))
    assert [status for status, _ in recorded] == [201, 201]
    payment_ids = {body["data"]["id"] for _, body in recorded}
    assert len(payment_ids) == 1
    assert _counts(owner["user"]["companyId"]) == (1, 1, 1)

    payment_id = payment_ids.pop()
    refund_barrier = threading.Barrier(2)

    def refund() -> tuple[int, dict]:
        refund_barrier.wait()
        response = client.post(
            f"/api/v1/finance/payments/{payment_id}/refund",
            headers=_headers(owner, "concurrent-refund"),
            json={"amount": "40.00", "reason": "concurrent"},
        )
        return response.status_code, response.json()

    with ThreadPoolExecutor(max_workers=2) as pool:
        refunded = list(pool.map(lambda _: refund(), range(2)))
    assert [status for status, _ in refunded] == [200, 200]
    assert {body["data"]["refundedAmount"] for _, body in refunded} == {"40.00"}
    assert _counts(owner["user"]["companyId"]) == (1, 2, 2)


def test_expired_recycling_and_incomplete_record_fail_closed(client):
    owner = _register(client, "idempotency-state")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    url = _payment_url(invoice["id"])
    first = client.post(url, headers=_headers(owner, "recyclable"), json=_record_body("20.00"))
    assert first.status_code == 201
    _expire_or_incomplete(owner["user"]["companyId"], "payments.record", "recyclable", expire=True)
    recycled = client.post(url, headers=_headers(owner, "recyclable"), json=_record_body("10.00"))
    assert recycled.status_code == 201
    assert recycled.json()["data"]["id"] != first.json()["data"]["id"]

    incomplete = client.post(url, headers=_headers(owner, "incomplete"), json=_record_body("5.00"))
    assert incomplete.status_code == 201
    _expire_or_incomplete(owner["user"]["companyId"], "payments.record", "incomplete", expire=False)
    failed_closed = client.post(url, headers=_headers(owner, "incomplete"), json=_record_body("5.00"))
    assert failed_closed.status_code == 409
    assert failed_closed.json()["errors"][0]["reason"] == "idempotency_record_incomplete"


def test_audit_failure_rolls_back_payment_invoice_and_claim(client, monkeypatch):
    from app.api.v1.finance import payments as payments_api

    owner = _register(client, "audit-rollback")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    url = _payment_url(invoice["id"])

    async def fail_audit(*args, **kwargs):
        raise RuntimeError("forced audit failure")

    original = payments_api.audit_service.record
    monkeypatch.setattr(payments_api.audit_service, "record", fail_audit)
    with pytest.raises(RuntimeError, match="forced audit failure"):
        client.post(url, headers=_headers(owner, "audit-failure"), json=_record_body("20.00"))
    assert _counts(owner["user"]["companyId"]) == (0, 0, 0)

    monkeypatch.setattr(payments_api.audit_service, "record", original)
    retry = client.post(url, headers=_headers(owner, "audit-failure"), json=_record_body("20.00"))
    assert retry.status_code == 201
    assert _counts(owner["user"]["companyId"]) == (1, 1, 1)


def test_idempotency_result_failure_rolls_back_payment_audit_and_claim(client):
    owner = _register(client, "result-rollback")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    url = _payment_url(invoice["id"])
    _set_result_failure_trigger(owner["user"]["companyId"], enabled=True)
    try:
        with pytest.raises(Exception, match="forced idempotency result failure"):
            client.post(
                url,
                headers=_headers(owner, "result-failure"),
                json=_record_body("20.00"),
            )
    finally:
        _set_result_failure_trigger(owner["user"]["companyId"], enabled=False)
    assert _counts(owner["user"]["companyId"]) == (0, 0, 0)

    retry = client.post(
        url,
        headers=_headers(owner, "result-failure"),
        json=_record_body("20.00"),
    )
    assert retry.status_code == 201
    assert _counts(owner["user"]["companyId"]) == (1, 1, 1)


def test_idempotency_owner_rollback_releases_waiter(client):
    owner = _register(client, "owner-rollback")
    invoice = _invoice(client, owner, _customer(client, owner)["id"])
    created = client.post(
        _payment_url(invoice["id"]),
        headers=_headers(owner, "seed-result"),
        json=_record_body("10.00"),
    ).json()["data"]

    async def run() -> tuple[bool, int]:
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        owner_entered = asyncio.Event()
        release_owner = asyncio.Event()
        waiter_executions = 0

        async def owner_task() -> None:
            async with factory() as db:
                repo = PaymentRepository(
                    db,
                    company_id=uuid.UUID(owner["user"]["companyId"]),
                    user_id=uuid.UUID(owner["user"]["id"]),
                )

                async def fail_operation() -> Payment:
                    owner_entered.set()
                    await release_owner.wait()
                    raise RuntimeError("owner rollback")

                try:
                    await execute_idempotent(
                        db,
                        company_id=repo.company_id,
                        scope="payments.record",
                        idempotency_key="rollback-waiter",
                        request_hash="same-hash",
                        operation=fail_operation,
                        result_loader=repo.get_payment,
                    )
                except RuntimeError:
                    await db.rollback()

        async def waiter_task() -> bool:
            nonlocal waiter_executions
            await owner_entered.wait()
            async with factory() as db:
                repo = PaymentRepository(
                    db,
                    company_id=uuid.UUID(owner["user"]["companyId"]),
                    user_id=uuid.UUID(owner["user"]["id"]),
                )

                async def succeed() -> Payment:
                    nonlocal waiter_executions
                    waiter_executions += 1
                    return await repo.get_payment(uuid.UUID(created["id"]))

                result, replay = await execute_idempotent(
                    db,
                    company_id=repo.company_id,
                    scope="payments.record",
                    idempotency_key="rollback-waiter",
                    request_hash="same-hash",
                    operation=succeed,
                    result_loader=repo.get_payment,
                )
                await db.commit()
                return not replay and result.id == uuid.UUID(created["id"])

        first = asyncio.create_task(owner_task())
        second = asyncio.create_task(waiter_task())
        await owner_entered.wait()
        await asyncio.sleep(0)
        release_owner.set()
        await first
        waiter_owned = await second
        await engine.dispose()
        return waiter_owned, waiter_executions

    assert asyncio.run(run()) == (True, 1)
