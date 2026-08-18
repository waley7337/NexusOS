"""PB.1 migration tests against an isolated, disposable PostgreSQL cluster."""
from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import uuid
from pathlib import Path

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_REVISION = "c4e8f1a2b3d6"
PROFILE_REVISION = "e2f3a4b5c6d7"
PB1_REVISION = "f3a4b5c6d7e8"


def _run(command: list[str], *, env: dict[str, str] | None = None) -> str:
    completed = subprocess.run(
        command,
        cwd=BACKEND_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


@pytest.fixture(scope="module")
def disposable_postgres(tmp_path_factory):
    required = {name: shutil.which(name) for name in ("initdb", "pg_ctl", "createdb", "dropdb", "psql")}
    if not all(required.values()):
        pytest.skip("PostgreSQL server/client binaries are required for migration tests")

    root = tmp_path_factory.mktemp("pb1-postgres")
    data_dir = root / "data"
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    _run([required["initdb"], "-A", "trust", "-U", "postgres", "-D", str(data_dir)])
    _run(
        [
            required["pg_ctl"],
            "-D",
            str(data_dir),
            "-o",
            f"-F -h 127.0.0.1 -p {port}",
            "-l",
            str(root / "postgres.log"),
            "-w",
            "start",
        ]
    )
    try:
        yield {"port": str(port), **required}
    finally:
        _run([required["pg_ctl"], "-D", str(data_dir), "-m", "fast", "-w", "stop"])


@pytest.fixture
def migration_database(disposable_postgres):
    database = f"pb1_{uuid.uuid4().hex}"
    host_args = ["-h", "127.0.0.1", "-p", disposable_postgres["port"], "-U", "postgres"]
    _run([disposable_postgres["createdb"], *host_args, database])
    sync_url = f"postgresql://postgres@127.0.0.1:{disposable_postgres['port']}/{database}"
    async_url = f"postgresql+asyncpg://postgres@127.0.0.1:{disposable_postgres['port']}/{database}"
    try:
        yield {
            "async_url": async_url,
            "psql": disposable_postgres["psql"],
            "sync_url": sync_url,
        }
    finally:
        _run([disposable_postgres["dropdb"], *host_args, "--force", database])


def _upgrade(database: dict[str, str], revision: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = database["async_url"]
    env.setdefault("SECRET_KEY", "migration-test-secret-key-32-chars!!")
    _run([sys.executable, "-m", "alembic", "upgrade", revision], env=env)


def _downgrade(database: dict[str, str], revision: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = database["async_url"]
    env.setdefault("SECRET_KEY", "migration-test-secret-key-32-chars!!")
    _run([sys.executable, "-m", "alembic", "downgrade", revision], env=env)


def _sql(database: dict[str, str], sql: str) -> str:
    return _run(
        [
            database["psql"],
            database["sync_url"],
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-A",
            "-t",
            "-F",
            "|",
            "-c",
            sql,
        ]
    )


def _company_values(company_id: uuid.UUID, slug: str, plan: str, status: str, trial: str = "NULL") -> str:
    return (
        f"('{company_id}', 'PB1 {slug}', '{slug}', 'UTC', 'USD', "
        f"'{plan}', '{status}', {trial}, now(), now(), true)"
    )


def test_populated_production_lineage_upgrades_to_pb1_without_data_loss(migration_database):
    _upgrade(migration_database, PRODUCTION_REVISION)

    free_id, existing_id, paid_id, second_free_id = (uuid.uuid4() for _ in range(4))
    customer_id, invoice_id, payment_id = (uuid.uuid4() for _ in range(3))
    _sql(
        migration_database,
        f"""
        INSERT INTO companies (
            id, name, slug, timezone, currency, subscription_plan,
            subscription_status, trial_ends_at, created_at, updated_at, is_active
        ) VALUES
            {_company_values(free_id, 'free-a', 'FREE', 'TRIALING')},
            {_company_values(existing_id, 'existing-b', 'PRO', 'ACTIVE')},
            {_company_values(paid_id, 'paid-c', 'STARTER', 'PAST_DUE')},
            {_company_values(second_free_id, 'free-d', 'FREE', 'TRIALING')};

        INSERT INTO customers (
            id, company_id, company_name, status, created_at, updated_at, is_active
        ) VALUES (
            '{customer_id}', '{free_id}', 'Migration Customer', 'ACTIVE', now(), now(), true
        );
        INSERT INTO invoices (
            id, company_id, customer_id, invoice_number, issue_date, due_date,
            status, subtotal, tax, total, currency, created_at, updated_at, is_active
        ) VALUES (
            '{invoice_id}', '{free_id}', '{customer_id}', 'MIG-001', CURRENT_DATE,
            CURRENT_DATE, 'DRAFT', 10, 2, 12, 'USD', now(), now(), true
        );
        INSERT INTO payments (
            id, company_id, invoice_id, payment_method, amount, payment_date,
            status, created_at, updated_at, is_active
        ) VALUES (
            '{payment_id}', '{free_id}', '{invoice_id}', 'CASH', 12, CURRENT_DATE,
            'COMPLETED', now(), now(), true
        );
        """,
    )

    _upgrade(migration_database, PROFILE_REVISION)
    profile_id = uuid.uuid4()
    _sql(
        migration_database,
        f"""
        INSERT INTO platform_billing_profiles (
            id, company_id, created_at, updated_at, stripe_customer_id,
            stripe_subscription_id, stripe_price_id, plan, status,
            current_period_start, current_period_end, cancel_at_period_end,
            canceled_at, trial_ends_at, last_webhook_event_id, last_synced_at
        ) VALUES (
            '{profile_id}', '{existing_id}', '2026-01-01T00:00:00Z',
            '2026-02-01T00:00:00Z', 'cus_preserve', 'sub_preserve',
            'price_preserve', 'PRO', 'ACTIVE', '2026-02-01T00:00:00Z',
            '2026-03-01T00:00:00Z', true, NULL, NULL, 'evt_preserve',
            '2026-02-02T00:00:00Z'
        );
        """,
    )
    preserved_before = _sql(
        migration_database,
        f"SELECT row_to_json(p)::text FROM platform_billing_profiles p WHERE id = '{profile_id}';",
    )

    _upgrade(migration_database, PB1_REVISION)

    assert _sql(migration_database, "SELECT version_num FROM alembic_version;") == PB1_REVISION
    assert _sql(migration_database, "SELECT count(*) FROM platform_billing_profiles;") == "4"
    assert _sql(
        migration_database,
        f"SELECT plan, status, stripe_customer_id IS NULL, stripe_subscription_id IS NULL, "
        f"stripe_price_id IS NULL, current_period_start IS NULL, current_period_end IS NULL, "
        f"trial_ends_at IS NULL, cancel_at_period_end, canceled_at IS NULL "
        f"FROM platform_billing_profiles WHERE company_id = '{free_id}';",
    ) == "FREE|NO_SUBSCRIPTION|t|t|t|t|t|t|f|t"
    assert _sql(
        migration_database,
        f"SELECT plan, status, stripe_customer_id IS NULL FROM platform_billing_profiles "
        f"WHERE company_id = '{paid_id}';",
    ) == "STARTER|PAST_DUE|t"
    assert _sql(
        migration_database,
        f"SELECT row_to_json(p)::text FROM platform_billing_profiles p WHERE id = '{profile_id}';",
    ) == preserved_before
    assert _sql(
        migration_database,
        "SELECT count(*), min(amount), max(amount) FROM payments;",
    ) == "1|12.00|12.00"
    assert _sql(
        migration_database,
        "SELECT count(*), min(total), max(total) FROM invoices;",
    ) == "1|12.00|12.00"
    assert _sql(
        migration_database,
        "SELECT count(*) FROM pg_constraint WHERE conname IN ("
        "'fk_platform_billing_profiles_company_id_companies',"
        "'uq_platform_billing_profiles_company_id',"
        "'uq_platform_billing_profiles_stripe_customer',"
        "'uq_platform_billing_profiles_stripe_subscription');",
    ) == "4"

    _downgrade(migration_database, PROFILE_REVISION)
    assert _sql(
        migration_database,
        f"SELECT status FROM platform_billing_profiles WHERE company_id = '{free_id}';",
    ) == "NO_SUBSCRIPTION"
    _upgrade(migration_database, PB1_REVISION)
    assert _sql(migration_database, "SELECT count(*) FROM platform_billing_profiles;") == "4"


def test_ambiguous_free_state_aborts_pb1_atomically(migration_database):
    _upgrade(migration_database, PRODUCTION_REVISION)
    ambiguous_id = uuid.uuid4()
    _sql(
        migration_database,
        f"""
        INSERT INTO companies (
            id, name, slug, timezone, currency, subscription_plan,
            subscription_status, trial_ends_at, created_at, updated_at, is_active
        ) VALUES {_company_values(ambiguous_id, 'ambiguous', 'FREE', 'ACTIVE')};
        """,
    )
    _upgrade(migration_database, PROFILE_REVISION)

    with pytest.raises(subprocess.CalledProcessError):
        _upgrade(migration_database, PB1_REVISION)

    assert _sql(migration_database, "SELECT version_num FROM alembic_version;") == PROFILE_REVISION
    assert _sql(migration_database, "SELECT count(*) FROM platform_billing_profiles;") == "0"
    assert _sql(
        migration_database,
        f"SELECT subscription_plan, subscription_status FROM companies WHERE id = '{ambiguous_id}';",
    ) == "FREE|ACTIVE"
