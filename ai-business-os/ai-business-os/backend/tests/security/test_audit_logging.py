"""Positive regression coverage for audit logging — Part 3.1 remediation,
TEST-001.

Prior state (confirmed by reading `app/services/auth_service.py` before
writing these): `audit_service.record(...)` is wired into exactly three
call sites — `register` (`auth.user_registered`), `login`
(`auth.login_succeeded`), and the refresh-token-reuse compromise path
(`auth.session_compromise_detected`). `reset_password`, `verify_email`, and
`logout` do not call it at all — this matches what the Part 3.1 completion
report itself claims ("Wired `audit_service.record(...)` into `register`,
`login`, and the refresh-reuse compromise-detection path"), so it is not a
discrepancy to fix here, just the actual (and correctly scoped) set of
flows this file covers. Inventing audit calls for unaudited flows is out of
scope for this remediation pass.

Every test goes through the real HTTP API (`app.main.app`) against the real
Postgres database and reads back the actual persisted `AuditLog` row —
never `assert audit_service.record.called`.

A dedicated `NullPool` engine (`_run_db`) is used for every assertion query
and for cleanup — never `app.db.session.AsyncSessionLocal` — matching the
established pattern in `tests/test_auth_api.py` / `test_auth_service.py`:
`TestClient`'s pooled connections are bound to its own event loop, and a
bare `asyncio.run()` after the `with` block closes always starts a *new*
loop, so reusing the app's pooled engine here raises "Future attached to a
different loop" (reproduced while first writing this file, before the
`NullPool` engine was introduced).
"""
import asyncio
import ipaddress
import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.main import app  # noqa: E402
from app.models import AuditLog, AuthToken, Company, Role, Session, User, role_permissions, user_roles  # noqa: E402

_EMAIL_DOMAIN = "audittest.example.com"


def _run_db(coro_factory):
    """Runs a DB coroutine against a fresh `NullPool` engine on a fresh
    event loop, then disposes it — safe to call after a `TestClient`
    `with` block has already closed its own loop."""

    async def _wrapper():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                return await coro_factory(db)
        finally:
            await engine.dispose()

    return asyncio.run(_wrapper())


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _client(peer_host: str = "203.0.113.100") -> TestClient:
    """Real IPv4 peer by default so `ip_address` round-trips through the
    real `INET` column instead of the TestClient default `"testclient"`
    (which `_safe_ip` deliberately drops — covered explicitly by
    `test_unparseable_peer_does_not_block_the_business_operation` below)."""
    return TestClient(app, client=(peer_host, 12345))


async def _fetch_audit_rows(db, *, entity_id: uuid.UUID | None = None, action: str | None = None) -> list[AuditLog]:
    stmt = select(AuditLog)
    if entity_id is not None:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if action is not None:
        stmt = stmt.where(AuditLog.action == action)
    return list((await db.execute(stmt)).scalars().all())


@pytest.fixture(scope="module", autouse=True)
def _cleanup_module_data():
    yield

    async def _sweep(db):
        user_ids = (
            await db.execute(select(User.id).where(User.email.like(f"%@{_EMAIL_DOMAIN}")))
        ).scalars().all()
        company_ids = (
            await db.execute(select(User.company_id).where(User.id.in_(user_ids)))
        ).scalars().all()
        role_ids = (
            await db.execute(select(Role.id).where(Role.company_id.in_(company_ids)))
        ).scalars().all()

        if company_ids:
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

    _run_db(_sweep)


def _register(client: TestClient, tag: str, *, headers: dict | None = None) -> tuple[str, dict]:
    email = _unique_email(tag)
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"Audit Co {tag}",
            "firstName": "Ada",
            "lastName": "Lovelace",
            "email": email,
            "password": "AuditTest1234",
        },
        headers=headers or {},
    )
    assert res.status_code == 201, res.text
    return email, res.json()["data"]


# --------------------------------------------------------------------------- #
# auth.user_registered
# --------------------------------------------------------------------------- #

def test_registration_persists_expected_audit_record():
    with _client("198.51.100.10") as c:
        email, data = _register(c, "reg-basic", headers={"User-Agent": "AuditTestSuite/1.0"})

    user_id = uuid.UUID(data["user"]["id"])
    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.user_registered"))

    assert len(rows) == 1
    row = rows[0]
    assert row.entity == "users"
    assert row.entity_id == user_id
    assert row.user_id == user_id
    assert str(row.company_id) == data["user"]["companyId"]
    assert row.new_values == {"email": email, "role": "owner"}
    assert row.old_values is None
    # asyncpg maps `INET` to `ipaddress.IPv4Address`/`IPv6Address`, not `str`.
    assert str(row.ip_address) == "198.51.100.10"
    assert row.user_agent == "AuditTestSuite/1.0"
    assert row.created_at is not None


def test_registration_audit_ip_supports_ipv6():
    with _client("2001:db8::abcd") as c:
        email, data = _register(c, "reg-ipv6")

    user_id = uuid.UUID(data["user"]["id"])
    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.user_registered"))

    assert len(rows) == 1
    # Postgres INET normalizes IPv6 representation; compare as parsed
    # addresses rather than raw strings.
    assert rows[0].ip_address == ipaddress.ip_address("2001:db8::abcd")


def test_unparseable_peer_does_not_block_the_business_operation():
    """`TestClient`'s (and some real ASGI transports') synthetic/non-IP
    peer host must never crash or block registration — `_safe_ip` silently
    drops it, and the row is still written with `ip_address=None`."""
    with TestClient(app) as c:  # default peer host is the literal "testclient"
        email, data = _register(c, "reg-badpeer")

    user_id = uuid.UUID(data["user"]["id"])
    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.user_registered"))
    assert len(rows) == 1
    assert rows[0].ip_address is None
    assert rows[0].new_values == {"email": email, "role": "owner"}  # write itself unaffected


def test_registration_audit_never_persists_the_password():
    with _client() as c:
        email, data = _register(c, "reg-nopass")

    user_id = uuid.UUID(data["user"]["id"])
    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.user_registered"))
    row = rows[0]
    serialized = str(row.new_values) + str(row.old_values)
    assert "AuditTest1234" not in serialized  # the plaintext password used at registration


# --------------------------------------------------------------------------- #
# auth.login_succeeded
# --------------------------------------------------------------------------- #

def test_login_persists_expected_audit_record():
    with _client("198.51.100.20") as c:
        email, reg_data = _register(c, "login-basic")
        user_id = uuid.UUID(reg_data["user"]["id"])

        login_res = c.post(
            "/api/v1/auth/login",
            json={
                "companySlug": reg_data["user"]["companySlug"],
                "email": email,
                "password": "AuditTest1234",
            },
            headers={"User-Agent": "AuditTestSuite-Login/2.0"},
        )
    assert login_res.status_code == 200

    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.login_succeeded"))
    assert len(rows) == 1
    row = rows[0]
    assert row.entity == "users"
    assert row.user_id == user_id
    assert str(row.ip_address) == "198.51.100.20"
    assert row.user_agent == "AuditTestSuite-Login/2.0"


def test_failed_login_does_not_persist_a_login_succeeded_record():
    with _client("198.51.100.21") as c:
        email, reg_data = _register(c, "login-wrongpass")
        user_id = uuid.UUID(reg_data["user"]["id"])

        res = c.post(
            "/api/v1/auth/login",
            json={
                "companySlug": reg_data["user"]["companySlug"],
                "email": email,
                "password": "WrongPassword999",
            },
        )
    assert res.status_code == 401

    rows = _run_db(lambda db: _fetch_audit_rows(db, entity_id=user_id, action="auth.login_succeeded"))
    assert rows == []


# --------------------------------------------------------------------------- #
# auth.session_compromise_detected (refresh-token reuse)
# --------------------------------------------------------------------------- #

def test_refresh_token_reuse_persists_compromise_audit_record_and_revokes_all_sessions():
    with _client("198.51.100.30") as c:
        email, reg_data = _register(c, "compromise")
        user_id = uuid.UUID(reg_data["user"]["id"])
        original_refresh_token = reg_data["refreshToken"]

        # Legitimate rotation: consumes/revokes the original token, issues a
        # fresh pair.
        rotate_res = c.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": original_refresh_token},
        )
        assert rotate_res.status_code == 200

        # Replay the now-revoked original — a legitimate client would never
        # do this; this is exactly the "stolen/copied token" signature.
        replay_res = c.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": original_refresh_token},
            headers={"User-Agent": "AttackerReplay/1.0"},
        )
    assert replay_res.status_code == 401

    async def _fetch(db):
        rows = await _fetch_audit_rows(db, action="auth.session_compromise_detected")
        return [r for r in rows if r.user_id == user_id]

    rows = _run_db(_fetch)
    assert len(rows) == 1
    row = rows[0]
    assert row.entity == "sessions"
    assert row.new_values == {"reason": "refresh_token_reuse", "response": "all_sessions_revoked"}
    assert str(row.ip_address) == "198.51.100.30"
    assert row.user_agent == "AttackerReplay/1.0"

    # The explicit `db.commit()` fix this audit record depends on: verified
    # against a *fresh* NullPool connection, not one that might still be
    # holding an uncommitted view.
    async def _sessions(db):
        return (
            await db.execute(select(Session).where(Session.user_id == user_id))
        ).scalars().all()

    sessions = _run_db(_sessions)
    assert len(sessions) >= 2
    assert all(s.revoked_at is not None for s in sessions)


def test_legitimate_single_refresh_does_not_trigger_compromise_audit():
    with _client("198.51.100.31") as c:
        email, reg_data = _register(c, "no-false-positive")
        user_id = uuid.UUID(reg_data["user"]["id"])

        res = c.post("/api/v1/auth/refresh", json={"refreshToken": reg_data["refreshToken"]})
    assert res.status_code == 200

    async def _fetch(db):
        rows = await _fetch_audit_rows(db, action="auth.session_compromise_detected")
        return [r for r in rows if r.user_id == user_id]

    assert _run_db(_fetch) == []