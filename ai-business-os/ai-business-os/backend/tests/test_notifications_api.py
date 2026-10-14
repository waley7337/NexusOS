"""Notifications API — integration tests.

Covers: list, unread count, mark read, mark all read, auth, tenant + user
isolation, idempotent mark-read. Requires PostgreSQL (SKIP_DB_TESTS=1 to skip).
"""
from __future__ import annotations

import os
import uuid

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

_EMAIL_DOMAIN = "notificationsapitest.example.com"
_BASE = "/api/v1/notifications"
_TEST_DB = os.environ["DATABASE_URL"]


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "Notify1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"NotifyCo {tag}",
            "firstName": "Note",
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


def _insert_notification(
    *,
    company_id: str,
    user_id: str,
    title: str = "Hello",
    message: str = "World",
    is_read: bool = False,
    notification_type: str = "info",
) -> str:
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models.enums import NotificationType
    from app.models.notification import Notification

    nid = uuid.uuid4()

    async def _run():
        engine = create_async_engine(_TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                db.add(
                    Notification(
                        id=nid,
                        company_id=uuid.UUID(company_id),
                        user_id=uuid.UUID(user_id),
                        title=title,
                        message=message,
                        type=NotificationType(notification_type),
                        is_read=is_read,
                    )
                )
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())
    return str(nid)


def test_unauthenticated_returns_401(client: TestClient):
    assert client.get(_BASE).status_code == 401
    assert client.get(f"{_BASE}/unread-count").status_code == 401
    assert client.post(f"{_BASE}/read-all").status_code == 401


def test_empty_inbox_and_unread_count(client: TestClient):
    owner = _register(client, "empty")
    list_res = client.get(_BASE, headers=owner["headers"])
    assert list_res.status_code == 200, list_res.text
    body = list_res.json()["data"]
    assert body["items"] == []
    assert body["meta"]["total"] == 0

    count_res = client.get(f"{_BASE}/unread-count", headers=owner["headers"])
    assert count_res.status_code == 200
    assert count_res.json()["data"]["count"] == 0


def test_list_mark_read_and_mark_all(client: TestClient):
    owner = _register(client, "crud")
    uid = owner["user"]["id"]
    cid = owner["user"]["companyId"]

    n1 = _insert_notification(company_id=cid, user_id=uid, title="First", message="One")
    n2 = _insert_notification(
        company_id=cid, user_id=uid, title="Second", message="Two", notification_type="warning"
    )
    _insert_notification(
        company_id=cid, user_id=uid, title="Done", message="Already", is_read=True
    )

    list_res = client.get(_BASE, headers=owner["headers"])
    assert list_res.status_code == 200
    items = list_res.json()["data"]["items"]
    assert len(items) == 3
    assert items[0]["createdAt"] >= items[1]["createdAt"]

    unread_res = client.get(
        _BASE, headers=owner["headers"], params={"unreadOnly": True}
    )
    assert unread_res.status_code == 200
    assert unread_res.json()["data"]["meta"]["total"] == 2

    count_res = client.get(f"{_BASE}/unread-count", headers=owner["headers"])
    assert count_res.json()["data"]["count"] == 2

    mark_res = client.post(f"{_BASE}/{n1}/read", headers=owner["headers"])
    assert mark_res.status_code == 200, mark_res.text
    assert mark_res.json()["data"]["isRead"] is True

    # Idempotent
    mark_again = client.post(f"{_BASE}/{n1}/read", headers=owner["headers"])
    assert mark_again.status_code == 200
    assert mark_again.json()["data"]["isRead"] is True

    count_res = client.get(f"{_BASE}/unread-count", headers=owner["headers"])
    assert count_res.json()["data"]["count"] == 1

    all_res = client.post(f"{_BASE}/read-all", headers=owner["headers"])
    assert all_res.status_code == 200
    assert all_res.json()["data"]["updated"] == 1

    count_res = client.get(f"{_BASE}/unread-count", headers=owner["headers"])
    assert count_res.json()["data"]["count"] == 0

    # Second mark-all is a no-op
    all_again = client.post(f"{_BASE}/read-all", headers=owner["headers"])
    assert all_again.json()["data"]["updated"] == 0

    # Ensure n2 was marked
    listed = client.get(_BASE, headers=owner["headers"]).json()["data"]["items"]
    by_id = {row["id"]: row for row in listed}
    assert by_id[n2]["isRead"] is True


def test_user_cannot_see_or_mark_others_notifications(client: TestClient):
    a = _register(client, "isola")
    b = _register(client, "isolb")

    foreign = _insert_notification(
        company_id=a["user"]["companyId"],
        user_id=a["user"]["id"],
        title="Private",
        message="Only A",
    )

    # Different tenant cannot list A's notification
    list_b = client.get(_BASE, headers=b["headers"])
    assert list_b.status_code == 200
    assert list_b.json()["data"]["items"] == []

    mark_b = client.post(f"{_BASE}/{foreign}/read", headers=b["headers"])
    assert mark_b.status_code == 404

    # Same company, different user: invite a second user is heavy; simulate by
    # inserting a notification for a non-existent sibling via forged user id
    # that belongs to a different company — covered above. Within-tenant:
    # create notification addressed to B inside A's company (cross-user).
    cross_user = _insert_notification(
        company_id=a["user"]["companyId"],
        user_id=b["user"]["id"],  # B's user id but A's company — isolation by user_id
        title="Wrong",
        message="Should not appear for A",
    )
    list_a = client.get(_BASE, headers=a["headers"])
    ids = {row["id"] for row in list_a.json()["data"]["items"]}
    assert foreign in ids
    assert cross_user not in ids

    mark_a = client.post(f"{_BASE}/{cross_user}/read", headers=a["headers"])
    assert mark_a.status_code == 404
