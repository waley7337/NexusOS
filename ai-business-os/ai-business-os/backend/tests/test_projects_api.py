"""Projects and Tasks API — integration tests.

Covers: CRUD lifecycle, tenant isolation, RBAC, soft-delete, validation.
Requires a running PostgreSQL database. Skip with SKIP_DB_TESTS=1.
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

_EMAIL_DOMAIN = "projectsapitest.example.com"
_PROJECTS = "/api/v1/projects"
_TASKS = "/api/v1/tasks"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "ProjectsApi1234"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"ProjCo {tag}",
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


# ---------------------------------------------------------------------------
# Projects CRUD
# ---------------------------------------------------------------------------

class TestProjectsCRUD:
    def test_create_project(self, client: TestClient):
        user = _register(client, "p-create")
        res = client.post(
            _PROJECTS,
            headers=user["headers"],
            json={"name": "Alpha Project", "status": "PLANNED", "priority": "HIGH"},
        )
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert data["name"] == "Alpha Project"
        assert data["status"] == "PLANNED"
        assert data["priority"] == "HIGH"
        assert data["isActive"] is True
        assert data["companyId"] == user["user"]["companyId"]

    def test_create_requires_name(self, client: TestClient):
        user = _register(client, "p-noname")
        res = client.post(
            _PROJECTS, headers=user["headers"], json={"name": ""}
        )
        assert res.status_code == 422

    def test_list_projects(self, client: TestClient):
        user = _register(client, "p-list")
        for i in range(3):
            r = client.post(
                _PROJECTS,
                headers=user["headers"],
                json={"name": f"Project {i}"},
            )
            assert r.status_code == 201
        res = client.get(_PROJECTS, headers=user["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["data"]["total"] >= 3
        ids = [p["id"] for p in body["data"]["items"]]
        assert len(set(ids)) == len(ids)  # no duplicates

    def test_get_project(self, client: TestClient):
        user = _register(client, "p-get")
        pid = client.post(
            _PROJECTS, headers=user["headers"], json={"name": "GetMe"}
        ).json()["data"]["id"]
        res = client.get(f"{_PROJECTS}/{pid}", headers=user["headers"])
        assert res.status_code == 200
        assert res.json()["data"]["id"] == pid

    def test_update_project(self, client: TestClient):
        user = _register(client, "p-upd")
        pid = client.post(
            _PROJECTS, headers=user["headers"], json={"name": "Before"}
        ).json()["data"]["id"]
        res = client.patch(
            f"{_PROJECTS}/{pid}",
            headers=user["headers"],
            json={"name": "After", "status": "ACTIVE"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["name"] == "After"
        assert res.json()["data"]["status"] == "ACTIVE"

    def test_delete_project(self, client: TestClient):
        user = _register(client, "p-del")
        pid = client.post(
            _PROJECTS, headers=user["headers"], json={"name": "ToDelete"}
        ).json()["data"]["id"]
        del_res = client.delete(f"{_PROJECTS}/{pid}", headers=user["headers"])
        assert del_res.status_code == 200

        # After deletion the project should be soft-deleted (not listed by default)
        list_res = client.get(_PROJECTS, headers=user["headers"])
        ids = [p["id"] for p in list_res.json()["data"]["items"]]
        assert pid not in ids

    def test_filter_by_status(self, client: TestClient):
        user = _register(client, "p-filter")
        client.post(
            _PROJECTS, headers=user["headers"], json={"name": "Active1", "status": "ACTIVE"}
        )
        client.post(
            _PROJECTS, headers=user["headers"], json={"name": "Planned1", "status": "PLANNED"}
        )
        res = client.get(
            f"{_PROJECTS}?status=ACTIVE", headers=user["headers"]
        )
        assert res.status_code == 200
        items = res.json()["data"]["items"]
        assert all(p["status"] == "ACTIVE" for p in items)

    def test_unknown_project_id_404(self, client: TestClient):
        user = _register(client, "p-404")
        res = client.get(f"{_PROJECTS}/{uuid.uuid4()}", headers=user["headers"])
        assert res.status_code == 404

    def test_unauthenticated_rejected(self, client: TestClient):
        res = client.get(_PROJECTS)
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# Tenant isolation: project belongs to owner's company only
# ---------------------------------------------------------------------------

class TestProjectsTenantIsolation:
    def test_cross_tenant_project_not_visible(self, client: TestClient):
        owner_a = _register(client, "pi-a")
        owner_b = _register(client, "pi-b")

        # A creates a project
        pid = client.post(
            _PROJECTS, headers=owner_a["headers"], json={"name": "TenantA Project"}
        ).json()["data"]["id"]

        # B can't read it
        res = client.get(f"{_PROJECTS}/{pid}", headers=owner_b["headers"])
        assert res.status_code == 404

        # B's list shows no items from A
        list_res = client.get(_PROJECTS, headers=owner_b["headers"])
        ids = [p["id"] for p in list_res.json()["data"]["items"]]
        assert pid not in ids

    def test_cross_tenant_update_rejected(self, client: TestClient):
        owner_a = _register(client, "pi-upd-a")
        owner_b = _register(client, "pi-upd-b")
        pid = client.post(
            _PROJECTS, headers=owner_a["headers"], json={"name": "ProtectedProject"}
        ).json()["data"]["id"]
        res = client.patch(
            f"{_PROJECTS}/{pid}",
            headers=owner_b["headers"],
            json={"name": "Hijacked"},
        )
        assert res.status_code == 404

    def test_cross_tenant_delete_rejected(self, client: TestClient):
        owner_a = _register(client, "pi-del-a")
        owner_b = _register(client, "pi-del-b")
        pid = client.post(
            _PROJECTS, headers=owner_a["headers"], json={"name": "Protect Delete"}
        ).json()["data"]["id"]
        res = client.delete(f"{_PROJECTS}/{pid}", headers=owner_b["headers"])
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# Tasks CRUD
# ---------------------------------------------------------------------------

class TestTasksCRUD:
    def _make_project(self, client: TestClient, headers: dict) -> str:
        return client.post(
            _PROJECTS, headers=headers, json={"name": "TaskProject"}
        ).json()["data"]["id"]

    def test_create_task(self, client: TestClient):
        user = _register(client, "t-create")
        pid = self._make_project(client, user["headers"])
        res = client.post(
            _TASKS,
            headers=user["headers"],
            json={"projectId": pid, "title": "First Task"},
        )
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert data["title"] == "First Task"
        assert data["projectId"] == pid
        assert data["status"] == "TODO"

    def test_create_task_invalid_project_uuid(self, client: TestClient):
        user = _register(client, "t-badproj")
        res = client.post(
            _TASKS,
            headers=user["headers"],
            json={"projectId": "not-a-uuid", "title": "Bad"},
        )
        assert res.status_code == 422

    def test_list_tasks_filtered_by_project(self, client: TestClient):
        user = _register(client, "t-listfilt")
        pid_a = self._make_project(client, user["headers"])
        pid_b = self._make_project(client, user["headers"])
        client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid_a, "title": "TaskA1"},
        )
        client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid_a, "title": "TaskA2"},
        )
        client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid_b, "title": "TaskB1"},
        )
        res = client.get(
            f"{_TASKS}?projectId={pid_a}", headers=user["headers"]
        )
        assert res.status_code == 200
        items = res.json()["data"]["items"]
        assert all(t["projectId"] == pid_a for t in items)
        assert len(items) == 2

    def test_update_task_status(self, client: TestClient):
        user = _register(client, "t-upd")
        pid = self._make_project(client, user["headers"])
        tid = client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid, "title": "StatusChange"},
        ).json()["data"]["id"]
        res = client.patch(
            f"{_TASKS}/{tid}",
            headers=user["headers"],
            json={"status": "IN_PROGRESS"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "IN_PROGRESS"

    def test_delete_task(self, client: TestClient):
        user = _register(client, "t-del")
        pid = self._make_project(client, user["headers"])
        tid = client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid, "title": "DeleteMe"},
        ).json()["data"]["id"]
        del_res = client.delete(f"{_TASKS}/{tid}", headers=user["headers"])
        assert del_res.status_code == 200
        # Not listed after delete
        list_res = client.get(
            f"{_TASKS}?projectId={pid}", headers=user["headers"]
        )
        ids = [t["id"] for t in list_res.json()["data"]["items"]]
        assert tid not in ids

    def test_task_company_id_matches_creator(self, client: TestClient):
        user = _register(client, "t-comp")
        pid = self._make_project(client, user["headers"])
        res = client.post(
            _TASKS, headers=user["headers"],
            json={"projectId": pid, "title": "CompanyCheck"},
        )
        assert res.json()["data"]["companyId"] == user["user"]["companyId"]


# ---------------------------------------------------------------------------
# Task tenant isolation
# ---------------------------------------------------------------------------

class TestTasksTenantIsolation:
    def test_cross_tenant_task_not_accessible(self, client: TestClient):
        owner_a = _register(client, "ti-ta")
        owner_b = _register(client, "ti-tb")

        pid = client.post(
            _PROJECTS, headers=owner_a["headers"], json={"name": "TenantAProject"}
        ).json()["data"]["id"]
        tid = client.post(
            _TASKS, headers=owner_a["headers"],
            json={"projectId": pid, "title": "TenantATask"},
        ).json()["data"]["id"]

        # B cannot see the task
        res = client.get(f"{_TASKS}/{tid}", headers=owner_b["headers"])
        assert res.status_code == 404

    def test_cross_tenant_task_update_rejected(self, client: TestClient):
        owner_a = _register(client, "ti-upd-ta")
        owner_b = _register(client, "ti-upd-tb")

        pid = client.post(
            _PROJECTS, headers=owner_a["headers"], json={"name": "ProjectIsolate"}
        ).json()["data"]["id"]
        tid = client.post(
            _TASKS, headers=owner_a["headers"],
            json={"projectId": pid, "title": "IsolatedTask"},
        ).json()["data"]["id"]

        res = client.patch(
            f"{_TASKS}/{tid}",
            headers=owner_b["headers"],
            json={"title": "Hijacked"},
        )
        assert res.status_code == 404
