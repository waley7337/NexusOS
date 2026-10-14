"""Leave requests + Attendance API integration tests."""
from __future__ import annotations

import os
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

_EMAIL_DOMAIN = "leaveattendance.example.com"
_LEAVE = "/api/v1/hr/leave-requests"
_ATTENDANCE = "/api/v1/hr/attendance"
_EMPLOYEES = "/api/v1/hr/employees"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "LeaveAttend1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"LeaveCo {tag}",
            "firstName": "Lee",
            "lastName": tag.title(),
            "email": email,
            "password": password,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    return {
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
    }


def _link_employee(client: TestClient, owner: dict) -> dict:
    res = client.post(
        _EMPLOYEES,
        headers=owner["headers"],
        json={
            "userId": owner["user"]["id"],
            "employeeNumber": f"E-{os.urandom(2).hex()}",
            "department": "Ops",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


def test_leave_crud_approve_and_tenant_isolation(client: TestClient):
    a = _register(client, "leavea")
    b = _register(client, "leaveb")
    emp_a = _link_employee(client, a)

    today = date.today()
    create = client.post(
        _LEAVE,
        headers=a["headers"],
        json={
            "leaveType": "vacation",
            "startDate": today.isoformat(),
            "endDate": (today + timedelta(days=2)).isoformat(),
            "reason": "Trip",
        },
    )
    assert create.status_code == 201, create.text
    leave = create.json()["data"]
    assert leave["approvalStatus"] == "pending"
    assert leave["employeeId"] == emp_a["id"]

    listed = client.get(_LEAVE, headers=a["headers"])
    assert listed.status_code == 200
    assert listed.json()["data"]["meta"]["total"] >= 1

    # Other tenant cannot see
    other = client.get(_LEAVE, headers=b["headers"])
    assert other.status_code == 200
    assert other.json()["data"]["items"] == []

    # Invalid date range
    bad = client.post(
        _LEAVE,
        headers=a["headers"],
        json={
            "leaveType": "sick",
            "startDate": (today + timedelta(days=3)).isoformat(),
            "endDate": today.isoformat(),
        },
    )
    assert bad.status_code == 422 or bad.status_code == 400

    approved = client.post(f"{_LEAVE}/{leave['id']}/approve", headers=a["headers"])
    assert approved.status_code == 200, approved.text
    assert approved.json()["data"]["approvalStatus"] == "approved"

    # Cannot re-approve
    again = client.post(f"{_LEAVE}/{leave['id']}/approve", headers=a["headers"])
    assert again.status_code in (400, 422)


def test_attendance_clock_in_out_and_isolation(client: TestClient):
    a = _register(client, "atta")
    b = _register(client, "attb")
    emp = _link_employee(client, a)

    clock_in = client.post(f"{_ATTENDANCE}/clock-in", headers=a["headers"])
    assert clock_in.status_code == 201, clock_in.text
    row = clock_in.json()["data"]
    assert row["employeeId"] == emp["id"]
    assert row["clockIn"] is not None
    assert row["clockOut"] is None

    dup = client.post(f"{_ATTENDANCE}/clock-in", headers=a["headers"])
    assert dup.status_code in (400, 422)

    clock_out = client.post(f"{_ATTENDANCE}/clock-out", headers=a["headers"])
    assert clock_out.status_code == 200, clock_out.text
    done = clock_out.json()["data"]
    assert done["clockOut"] is not None
    assert done["hoursWorked"] is not None

    listed = client.get(_ATTENDANCE, headers=a["headers"])
    assert listed.status_code == 200
    assert listed.json()["data"]["meta"]["total"] >= 1

    other = client.get(_ATTENDANCE, headers=b["headers"])
    assert other.status_code == 200
    assert other.json()["data"]["items"] == []


def test_unauthenticated_leave_attendance_401(client: TestClient):
    assert client.get(_LEAVE).status_code == 401
    assert client.get(_ATTENDANCE).status_code == 401
    assert client.post(f"{_ATTENDANCE}/clock-in").status_code == 401
