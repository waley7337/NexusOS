"""08.4.1 migration checks against an isolated disposable PostgreSQL cluster."""
from __future__ import annotations

import asyncio
import os
import shutil
import socket
import subprocess
import sys
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.enums import PaymentMethod
from app.repositories.finance import InvoiceRepository
from app.repositories.payments import PaymentRepository
from app.services.payment_service import PaymentService

ROOT = Path(__file__).resolve().parents[1]
PARENT = "f3a4b5c6d7e8"
REVISION = "a4b5c6d7e8f9"


def run(command: list[str], *, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, env=env, check=check, capture_output=True, text=True)


@pytest.fixture(scope="module")
def pg_cluster(tmp_path_factory):
    tools = {name: shutil.which(name) for name in ("initdb", "pg_ctl", "createdb", "dropdb", "psql")}
    if not all(tools.values()):
        pytest.skip("PostgreSQL server/client binaries are required")
    root = tmp_path_factory.mktemp("payment-authority-postgres")
    data = root / "data"
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    run([tools["initdb"], "-A", "trust", "-U", "postgres", "-D", str(data)])  # type: ignore[list-item]
    run([tools["pg_ctl"], "-D", str(data), "-o", f"-F -h 127.0.0.1 -p {port}", "-l", str(root / "postgres.log"), "-w", "start"])  # type: ignore[list-item]
    try:
        yield {**tools, "port": str(port)}
    finally:
        run([tools["pg_ctl"], "-D", str(data), "-m", "fast", "-w", "stop"])  # type: ignore[list-item]


@pytest.fixture
def payment_database(pg_cluster):
    name = f"payauth_{uuid.uuid4().hex}"
    host = ["-h", "127.0.0.1", "-p", pg_cluster["port"], "-U", "postgres"]
    run([pg_cluster["createdb"], *host, name])
    sync_url = f"postgresql://postgres@127.0.0.1:{pg_cluster['port']}/{name}"
    async_url = f"postgresql+asyncpg://postgres@127.0.0.1:{pg_cluster['port']}/{name}"
    try:
        yield {"sync_url": sync_url, "async_url": async_url, "psql": pg_cluster["psql"]}
    finally:
        run([pg_cluster["dropdb"], *host, "--force", name])


def alembic(database, action: str, revision: str, *, check: bool = True):
    env = os.environ.copy()
    env["DATABASE_URL"] = database["async_url"]
    env.setdefault("SECRET_KEY", "payment-migration-test-secret-32!!")
    return run([sys.executable, "-m", "alembic", action, revision], env=env, check=check)


def sql(database, statement: str, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run([database["psql"], database["sync_url"], "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", statement], check=check)


def seed_invoice(database, *, amount: str = "100", payment_status: str | None = None, confirmed: str = "NULL") -> dict[str, uuid.UUID]:
    ids = {name: uuid.uuid4() for name in ("company", "user", "customer", "invoice", "payment")}
    payment_sql = ""
    if payment_status:
        payment_sql = f"""
        INSERT INTO payments (
            id, company_id, invoice_id, payment_method, amount, payment_date, status,
            currency, source, refunded_amount, confirmed_at, created_at, updated_at, is_active
        ) VALUES (
            '{ids['payment']}', '{ids['company']}', '{ids['invoice']}', 'CASH', {amount}, CURRENT_DATE,
            '{payment_status}', 'USD', 'MANUAL', 0, {confirmed}, now(), now(), true
        );"""
    sql(database, f"""
        INSERT INTO companies (id, name, slug, timezone, currency, subscription_plan, subscription_status, created_at, updated_at, is_active)
        VALUES ('{ids['company']}', 'Pay Authority', 'pay-{ids['company'].hex}', 'UTC', 'USD', 'FREE', 'TRIALING', now(), now(), true);
        INSERT INTO users (id, company_id, first_name, last_name, email, status, email_verified, two_factor_enabled, created_at, updated_at, is_active)
        VALUES ('{ids['user']}', '{ids['company']}', 'Pay', 'User', 'pay-{ids['user'].hex}@example.com', 'ACTIVE', true, false, now(), now(), true);
        INSERT INTO customers (id, company_id, company_name, status, created_at, updated_at, is_active)
        VALUES ('{ids['customer']}', '{ids['company']}', 'Customer', 'ACTIVE', now(), now(), true);
        INSERT INTO invoices (id, company_id, customer_id, invoice_number, issue_date, due_date, status, subtotal, tax, total, currency, created_at, updated_at, is_active)
        VALUES ('{ids['invoice']}', '{ids['company']}', '{ids['customer']}', 'PAY-1', CURRENT_DATE, CURRENT_DATE, 'SENT', 100, 0, 100, 'USD', now(), now(), true);
        {payment_sql}
    """)
    return ids


def test_upgrade_constraints_actor_fk_index_and_safe_reupgrade(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database, payment_status="COMPLETED", confirmed="now()")
    alembic(payment_database, "upgrade", REVISION)
    assert sql(payment_database, "SELECT version_num FROM alembic_version").stdout.strip() == REVISION
    assert sql(payment_database, "SELECT count(*) FROM pg_constraint WHERE conname LIKE 'ck_payments_payment_%'").stdout.strip() == "8"
    assert sql(payment_database, "SELECT count(*) FROM pg_indexes WHERE indexname = 'ix_payments_company_payment_date_id'").stdout.strip() == "1"
    assert sql(payment_database, f"UPDATE payments SET amount = 0 WHERE id = '{ids['payment']}'", check=False).returncode != 0

    # No new attribution exists yet, so downgrade is lossless and re-upgrade composes.
    alembic(payment_database, "downgrade", PARENT)
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "1"
    alembic(payment_database, "upgrade", REVISION)
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "1"


def test_invalid_existing_financial_data_fails_closed_without_deletion(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database, amount="0", payment_status="PENDING")
    result = alembic(payment_database, "upgrade", REVISION, check=False)
    assert result.returncode != 0
    assert "[invalid_financial_state]" in result.stderr
    assert "count=1" in result.stderr
    assert str(ids["payment"]) in result.stderr
    assert sql(payment_database, "SELECT version_num FROM alembic_version").stdout.strip() == PARENT
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "1"


def test_missing_confirmation_diagnostic_is_actionable(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database, amount="10", payment_status="COMPLETED")

    result = alembic(payment_database, "upgrade", REVISION, check=False)

    assert result.returncode != 0
    assert "[missing_confirmation_authority]" in result.stderr
    assert "count=1" in result.stderr
    assert str(ids["payment"]) in result.stderr
    assert "do not invent actors or alembic stamp" in result.stderr


def test_manual_provider_identity_diagnostic_is_actionable(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database)
    payment_id = uuid.uuid4()
    sql(payment_database, f"""INSERT INTO payments (
        id, company_id, invoice_id, payment_method, amount, payment_date, status, currency, source,
        provider_payment_id, refunded_amount, confirmed_at, created_at, updated_at, is_active
    ) VALUES ('{payment_id}', '{ids['company']}', '{ids['invoice']}', 'CASH', 10, CURRENT_DATE,
        'COMPLETED', 'USD', 'MANUAL', 'legacy-provider-id', 0, now(), now(), now(), true)""")

    result = alembic(payment_database, "upgrade", REVISION, check=False)

    assert result.returncode != 0
    assert "[manual_provider_identity_inconsistency]" in result.stderr
    assert str(payment_id) in result.stderr


def test_cross_tenant_actor_diagnostic_is_actionable(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database)
    other_company, other_user, payment_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    sql(payment_database, f"""
        INSERT INTO companies (id, name, slug, timezone, currency, subscription_plan, subscription_status, created_at, updated_at, is_active)
        VALUES ('{other_company}', 'Other', 'other-{other_company.hex}', 'UTC', 'USD', 'FREE', 'TRIALING', now(), now(), true);
        INSERT INTO users (id, company_id, first_name, last_name, email, status, email_verified, two_factor_enabled, created_at, updated_at, is_active)
        VALUES ('{other_user}', '{other_company}', 'Other', 'User', 'other-{other_user.hex}@example.com', 'ACTIVE', true, false, now(), now(), true);
        INSERT INTO payments (
            id, company_id, invoice_id, payment_method, amount, payment_date, status, currency, source,
            refunded_amount, confirmed_at, created_by, created_at, updated_at, is_active
        ) VALUES ('{payment_id}', '{ids['company']}', '{ids['invoice']}', 'CASH', 10, CURRENT_DATE,
            'COMPLETED', 'USD', 'MANUAL', 0, now(), '{other_user}', now(), now(), true);
    """)

    result = alembic(payment_database, "upgrade", REVISION, check=False)

    assert result.returncode != 0
    assert "[tenant_or_invoice_inconsistency]" in result.stderr
    assert str(payment_id) in result.stderr


def test_constraints_reject_invalid_rows_and_cross_tenant_actor(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    other_company, other_user = uuid.uuid4(), uuid.uuid4()
    sql(payment_database, f"""
        INSERT INTO companies (id, name, slug, timezone, currency, subscription_plan, subscription_status, created_at, updated_at, is_active)
        VALUES ('{other_company}', 'Other', 'other-{other_company.hex}', 'UTC', 'USD', 'FREE', 'TRIALING', now(), now(), true);
        INSERT INTO users (id, company_id, first_name, last_name, email, status, email_verified, two_factor_enabled, created_at, updated_at, is_active)
        VALUES ('{other_user}', '{other_company}', 'Other', 'User', 'other-{other_user.hex}@example.com', 'ACTIVE', true, false, now(), now(), true);
    """)
    def payment_insert(
        *, amount: str = "10", currency: str = "USD", actor: uuid.UUID = ids["user"],
        status: str = "COMPLETED", refunded: str = "0", confirmed: str = "now()",
        refunded_at: str = "NULL", reason: str = "NULL", source: str = "MANUAL",
        provider: str = "NULL", provider_account: str = "NULL", failure_code: str = "NULL",
    ) -> str:
        return f"""INSERT INTO payments (
            id, company_id, invoice_id, payment_method, amount, payment_date, status, currency, source,
            provider, provider_account_id, failure_code, refunded_amount, confirmed_at, confirmed_by,
            refunded_at, refund_reason, created_at, updated_at, is_active
        ) VALUES (gen_random_uuid(), '{ids['company']}', '{ids['invoice']}', 'CASH', {amount}, CURRENT_DATE,
            '{status}', '{currency}', '{source}', {provider}, {provider_account}, {failure_code}, {refunded},
            {confirmed}, '{actor}', {refunded_at}, {reason}, now(), now(), true)"""

    invalid_rows = [
        payment_insert(amount="0"),
        payment_insert(amount="-1"),
        payment_insert(amount="'NaN'"),
        payment_insert(amount="'Infinity'"),
        payment_insert(amount="'-Infinity'"),
        payment_insert(refunded="-1"),
        payment_insert(refunded="'NaN'", refunded_at="now()", reason="'x'"),
        payment_insert(refunded="11", refunded_at="now()", reason="'x'"),
        payment_insert(currency="usd"),
        payment_insert(status="REFUNDED", refunded="5", refunded_at="now()", reason="'x'"),
        payment_insert(confirmed="NULL"),
        payment_insert(status="REFUNDED", refunded="10"),
        payment_insert(status="PENDING", confirmed="now()"),
        payment_insert(status="FAILED", confirmed="now()"),
        payment_insert(refunded="1"),
        payment_insert(refunded="1", refunded_at="now()", reason="'   '"),
        payment_insert(reason="'metadata with zero refund'"),
        payment_insert(provider="'STRIPE'"),
        payment_insert(source="PROVIDER"),
        payment_insert(failure_code="'declined'"),
        payment_insert(actor=other_user),
    ]
    for statement in invalid_rows:
        assert sql(payment_database, statement, check=False).returncode != 0


def _insert_historical_payment(database, ids, amount: str, *, refunded: str = "0", status: str = "COMPLETED") -> uuid.UUID:
    payment_id = uuid.uuid4()
    sql(database, f"""INSERT INTO payments (
        id, company_id, invoice_id, payment_method, amount, payment_date, status, currency, source,
        refunded_amount, confirmed_at, created_at, updated_at, is_active
    ) VALUES ('{payment_id}', '{ids['company']}', '{ids['invoice']}', 'CASH', {amount}, CURRENT_DATE,
        '{status}', 'USD', 'MANUAL', {refunded}, now(), now(), now(), true)""")
    return payment_id


def test_aggregate_historical_overpayment_preflight_rejects_with_diagnostics(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database)
    _insert_historical_payment(payment_database, ids, "70")
    _insert_historical_payment(payment_database, ids, "70")

    result = alembic(payment_database, "upgrade", REVISION, check=False)

    assert result.returncode != 0
    assert "[aggregate_invoice_overpayment]" in result.stderr
    assert "count=1" in result.stderr
    assert str(ids["invoice"]) in result.stderr
    assert sql(payment_database, "SELECT version_num FROM alembic_version").stdout.strip() == PARENT
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "2"


def test_valid_aggregate_historical_balance_upgrades(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database)
    _insert_historical_payment(payment_database, ids, "70")
    _insert_historical_payment(payment_database, ids, "30")

    alembic(payment_database, "upgrade", REVISION)

    assert sql(payment_database, "SELECT version_num FROM alembic_version").stdout.strip() == REVISION
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "2"


def test_historical_refund_reports_attribution_diagnostic(payment_database):
    alembic(payment_database, "upgrade", PARENT)
    ids = seed_invoice(payment_database)
    payment_id = _insert_historical_payment(payment_database, ids, "100", refunded="20")

    result = alembic(payment_database, "upgrade", REVISION, check=False)

    assert result.returncode != 0
    assert "[historical_refund_requires_attribution]" in result.stderr
    assert "count=1" in result.stderr
    assert str(payment_id) in result.stderr


def test_downgrade_refuses_to_discard_new_financial_attribution(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    sql(payment_database, f"""INSERT INTO payments (
        id, company_id, invoice_id, payment_method, amount, payment_date, status, currency, source,
        refunded_amount, confirmed_at, confirmed_by, created_at, updated_at, is_active
    ) VALUES (gen_random_uuid(), '{ids['company']}', '{ids['invoice']}', 'CASH', 10, CURRENT_DATE,
        'COMPLETED', 'USD', 'MANUAL', 0, now(), '{ids['user']}', now(), now(), true)""")
    result = alembic(payment_database, "downgrade", PARENT, check=False)
    assert result.returncode != 0
    assert "downgrade refused" in result.stderr
    assert sql(payment_database, "SELECT version_num FROM alembic_version").stdout.strip() == REVISION


NOW = datetime(2026, 8, 18, 12, tzinfo=UTC)


class StartBarrier:
    """Release exactly when every competitor reaches the invoice-lock boundary."""

    def __init__(self, parties: int = 2):
        self.parties = parties
        self.arrivals = 0
        self._lock = asyncio.Lock()
        self._release = asyncio.Event()

    async def wait(self) -> None:
        async with self._lock:
            self.arrivals += 1
            if self.arrivals == self.parties:
                self._release.set()
        await self._release.wait()


class CoordinatedPaymentRepository(PaymentRepository):
    def __init__(self, *args, barrier: StartBarrier | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.barrier = barrier

    async def lock_invoice(self, invoice_id: uuid.UUID):
        if self.barrier is not None:
            await self.barrier.wait()
        return await super().lock_invoice(invoice_id)


class CoordinatedInvoiceRepository(InvoiceRepository):
    def __init__(self, *args, barrier: StartBarrier | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.barrier = barrier

    async def void_invoice(self, invoice_id: uuid.UUID):
        if self.barrier is not None:
            await self.barrier.wait()
        return await super().void_invoice(invoice_id)


async def _run_payment(database, ids, amount: str, barrier: StartBarrier | None = None) -> bool:
    engine = create_async_engine(database["async_url"], poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            try:
                service = PaymentService(
                    CoordinatedPaymentRepository(
                        session, company_id=ids["company"], user_id=ids["user"], barrier=barrier,
                    ),
                    clock=lambda: NOW,
                )
                await service.record_manual_payment(
                    invoice_id=ids["invoice"], amount=Decimal(amount), currency="USD",
                    payment_method=PaymentMethod.CASH, payment_date=date(2026, 8, 18),
                )
                await session.commit()
                return True
            except ConflictError:
                await session.rollback()
                return False
    finally:
        await engine.dispose()


async def _run_refund(database, ids, amount: str, barrier: StartBarrier | None = None) -> bool:
    engine = create_async_engine(database["async_url"], poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            try:
                service = PaymentService(
                    CoordinatedPaymentRepository(
                        session, company_id=ids["company"], user_id=ids["user"], barrier=barrier,
                    ),
                    clock=lambda: NOW,
                )
                await service.refund_manual_payment(
                    payment_id=ids["payment"], amount=Decimal(amount), reason="Concurrent refund",
                )
                await session.commit()
                return True
            except ConflictError:
                await session.rollback()
                return False
    finally:
        await engine.dispose()


async def _run_void(database, ids, barrier: StartBarrier | None = None) -> bool:
    engine = create_async_engine(database["async_url"], poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            try:
                await CoordinatedInvoiceRepository(
                    session, company_id=ids["company"], user_id=ids["user"], barrier=barrier,
                ).void_invoice(ids["invoice"])
                await session.commit()
                return True
            except ConflictError:
                await session.rollback()
                return False
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_concurrent_payments_cannot_overpay_invoice(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)

    barrier = StartBarrier()
    outcomes = await asyncio.gather(
        _run_payment(payment_database, ids, "70", barrier),
        _run_payment(payment_database, ids, "70", barrier),
    )

    assert sorted(outcomes) == [False, True]
    assert barrier.arrivals == 2
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "1"
    assert sql(payment_database, "SELECT status FROM invoices").stdout.strip() == "PARTIALLY_PAID"


@pytest.mark.asyncio
async def test_payment_and_void_serialize_without_contradictory_state(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)

    barrier = StartBarrier()
    payment_ok, void_ok = await asyncio.gather(
        _run_payment(payment_database, ids, "10", barrier),
        _run_void(payment_database, ids, barrier),
    )

    assert payment_ok != void_ok
    assert barrier.arrivals == 2
    state = sql(payment_database, "SELECT status FROM invoices").stdout.strip()
    count = sql(payment_database, "SELECT count(*) FROM payments").stdout.strip()
    assert (state, count) in {("PARTIALLY_PAID", "1"), ("VOID", "0")}


@pytest.mark.asyncio
async def test_concurrent_refunds_cannot_exceed_refundable_balance(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    assert await _run_payment(payment_database, ids, "100")
    ids["payment"] = uuid.UUID(sql(payment_database, "SELECT id FROM payments").stdout.strip())

    barrier = StartBarrier()
    outcomes = await asyncio.gather(
        _run_refund(payment_database, ids, "60", barrier),
        _run_refund(payment_database, ids, "60", barrier),
    )

    assert sorted(outcomes) == [False, True]
    assert barrier.arrivals == 2
    assert sql(payment_database, "SELECT refunded_amount FROM payments").stdout.strip() == "60.00"
    assert sql(payment_database, "SELECT status FROM payments").stdout.strip() == "COMPLETED"
    assert sql(payment_database, "SELECT status FROM invoices").stdout.strip() == "PARTIALLY_PAID"


@pytest.mark.asyncio
async def test_refund_and_new_payment_preserve_effective_balance(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    assert await _run_payment(payment_database, ids, "80")
    ids["payment"] = uuid.UUID(sql(payment_database, "SELECT id FROM payments").stdout.strip())

    barrier = StartBarrier()
    refund_ok, payment_ok = await asyncio.gather(
        _run_refund(payment_database, ids, "30", barrier),
        _run_payment(payment_database, ids, "50", barrier),
    )

    assert refund_ok is True
    assert barrier.arrivals == 2
    assert payment_ok in {False, True}
    engine = create_async_engine(payment_database["async_url"], poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            paid = await connection.scalar(text(
                "SELECT coalesce(sum(CASE WHEN status IN ('COMPLETED', 'REFUNDED') "
                "THEN amount - refunded_amount ELSE 0 END), 0) FROM payments"
            ))
            invoice_status = await connection.scalar(text("SELECT status FROM invoices"))
    finally:
        await engine.dispose()
    assert Decimal(str(paid)) <= Decimal("100")
    assert invoice_status == ("PAID" if paid == Decimal("100") else "PARTIALLY_PAID")


@pytest.mark.asyncio
async def test_payment_repository_hides_cross_tenant_invoice(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    engine = create_async_engine(payment_database["async_url"], poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            repository = PaymentRepository(
                session, company_id=uuid.uuid4(), user_id=ids["user"]
            )
            with pytest.raises(NotFoundError):
                await repository.lock_invoice(ids["invoice"])
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_invalid_timezone_rolls_back_flushed_payment_and_invoice_state(payment_database):
    alembic(payment_database, "upgrade", REVISION)
    ids = seed_invoice(payment_database)
    sql(payment_database, f"UPDATE companies SET timezone = 'Invalid/Timezone' WHERE id = '{ids['company']}'")
    engine = create_async_engine(payment_database["async_url"], poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            service = PaymentService(
                PaymentRepository(session, company_id=ids["company"], user_id=ids["user"]),
                clock=lambda: NOW,
            )
            with pytest.raises(ValidationError, match="timezone"):
                await service.record_manual_payment(
                    invoice_id=ids["invoice"], amount=Decimal("10"), currency="USD",
                    payment_method=PaymentMethod.CASH, payment_date=date(2026, 8, 18),
                )
            await session.rollback()
    finally:
        await engine.dispose()
    assert sql(payment_database, "SELECT count(*) FROM payments").stdout.strip() == "0"
    assert sql(payment_database, "SELECT status FROM invoices").stdout.strip() == "SENT"
