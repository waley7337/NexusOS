"""End-to-end tests for `/api/v1/auth/*` through the real ASGI app — the
HTTP envelope, status codes, and header behavior `test_auth_service.py`
doesn't cover (it calls the service layer directly).
"""
import os

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

_EMAIL_DOMAIN = "authapitest.example.com"


@pytest.fixture
def client():
    # `with` keeps one event loop alive for the client's lifetime — plain
    # `TestClient(app)` opens a fresh loop per request, which breaks pooled
    # asyncpg connections across successive calls in the same test.
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


@pytest.fixture(scope="module", autouse=True)
def _cleanup_module_data():
    """These tests go through the real app engine (unlike
    `test_auth_service.py`'s throwaway NullPool session) and therefore
    commit for real — sweep everything tagged with `_EMAIL_DOMAIN`."""
    yield
    import asyncio

    from sqlalchemy import delete, select

    from app.db.session import AsyncSessionLocal
    from app.models import AuthToken, Company, Role, Session, User, role_permissions, user_roles

    async def _sweep():
        async with AsyncSessionLocal() as db:
            user_ids = (
                await db.execute(select(User.id).where(User.email.like(f"%@{_EMAIL_DOMAIN}")))
            ).scalars().all()
            company_ids = (
                await db.execute(select(User.company_id).where(User.id.in_(user_ids)))
            ).scalars().all()
            role_ids = (
                await db.execute(select(Role.id).where(Role.company_id.in_(company_ids)))
            ).scalars().all()

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

    asyncio.run(_sweep())


def test_register_returns_standard_envelope_with_tokens(client):
    email = _unique_email("api-register")
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": "API Test Co",
            "firstName": "Grace",
            "lastName": "Hopper",
            "email": email,
            "password": "ApiTest1234",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["accessToken"] and body["data"]["refreshToken"]
    assert body["data"]["user"]["email"] == email
    assert body["data"]["user"]["role"] == "owner"


def test_register_validation_error_shape(client):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": "X",
            "firstName": "A",
            "lastName": "B",
            "email": "not-an-email",
            "password": "short",
        },
    )
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert any(e["field"] == "body.email" for e in body["errors"])


def test_login_then_me_round_trip(client):
    email = _unique_email("api-login")
    client.post(
        "/api/v1/auth/register",
        json={
            "companyName": "Login Co",
            "firstName": "Grace",
            "lastName": "Hopper",
            "email": email,
            "password": "ApiTest1234",
        },
    )

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "ApiTest1234"})
    assert login_res.status_code == 200
    access_token = login_res.json()["data"]["accessToken"]

    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200
    me_body = me_res.json()
    assert me_body["data"]["user"]["email"] == email
    assert "customers.read" in me_body["data"]["permissions"]


def test_me_without_token_is_unauthorized(client):
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["errors"][0]["code"] == "unauthorized"


def test_login_wrong_password_is_unauthorized(client):
    email = _unique_email("api-wrongpass")
    client.post(
        "/api/v1/auth/register",
        json={
            "companyName": "Wrong Pass Co",
            "firstName": "Grace",
            "lastName": "Hopper",
            "email": email,
            "password": "ApiTest1234",
        },
    )
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "WrongOne123"})
    assert res.status_code == 401


def test_forgot_password_always_returns_success_envelope(client):
    res = client.post("/api/v1/auth/forgot-password", json={"email": "definitely-nobody@example.com"})
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_refresh_rejects_garbage_token(client):
    res = client.post("/api/v1/auth/refresh", json={"refreshToken": "not-a-real-token"})
    assert res.status_code == 401
