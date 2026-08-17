"""Part 07.2 — Employees API: tenant isolation, RBAC, compensation, CRUD."""

from __future__ import annotations

import os
import uuid

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
_EMAIL_DOMAIN = "employeesapitest.example.com"
_BASE = "/api/v1/hr/employees"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "EmployeesApi1234"
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


def _create_employee(client: TestClient, session: dict, **overrides) -> dict:
    body = {
        "employeeNumber": overrides.pop("employeeNumber", f"EMP-{os.urandom(3).hex()}"),
        "firstName": overrides.pop("firstName", "Pat"),
        "lastName": overrides.pop("lastName", "Worker"),
        "employmentType": overrides.pop("employmentType", "full_time"),
        "status": overrides.pop("status", "active"),
    }
    body.update(overrides)
    res = client.post(_BASE, json=body, headers=_auth(session))
    assert res.status_code == 201, res.text
    return res.json()["data"]


@pytest.fixture(scope="module", autouse=True)
def _cleanup_module_data():
    yield
    import asyncio

    from sqlalchemy import delete, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import (
        AuditLog,
        AuthToken,
        Company,
        Employee,
        Role,
        Session,
        User,
        role_permissions,
        user_roles,
    )

    async def _sweep():
        cleanup_engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(cleanup_engine, expire_on_commit=False)
        try:
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
                    await db.execute(
                        delete(Employee).where(Employee.company_id.in_(company_ids))
                    )
                    await db.execute(
                        delete(AuditLog).where(AuditLog.company_id.in_(company_ids))
                    )
                if user_ids:
                    await db.execute(delete(Session).where(Session.user_id.in_(user_ids)))
                    await db.execute(
                        delete(AuthToken).where(AuthToken.user_id.in_(user_ids))
                    )
                    await db.execute(
                        user_roles.delete().where(user_roles.c.user_id.in_(user_ids))
                    )
                if role_ids:
                    await db.execute(
                        role_permissions.delete().where(
                            role_permissions.c.role_id.in_(role_ids)
                        )
                    )
                    await db.execute(delete(Role).where(Role.id.in_(role_ids)))
                if user_ids:
                    await db.execute(delete(User).where(User.id.in_(user_ids)))
                if company_ids:
                    await db.execute(delete(Company).where(Company.id.in_(company_ids)))
                await db.commit()
        finally:
            await cleanup_engine.dispose()

    asyncio.run(_sweep())


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
                        )
                    )
                ).scalar_one()
                user.roles = [role]
                await db.commit()
        finally:
            await engine.dispose()

    asyncio.run(_run())


def _login(client: TestClient, email: str, password: str, company_slug: str) -> dict:
    res = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
            "companySlug": company_slug,
        },
    )
    assert res.status_code == 200, res.text
    token = res.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _response_has_no_salary_grade(payload: dict) -> None:
    assert "salaryGrade" not in payload
    assert "salary_grade" not in payload


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_create_get_list_update_archive_flow(client):
    owner = _register(client, "flow")
    created = _create_employee(
        client,
        owner,
        employeeNumber="FLOW-001",
        firstName="Flow",
        lastName="Person",
        department="Engineering",
        salaryGrade="G7",
    )
    assert created["employeeNumber"] == "FLOW-001"
    assert created["companyId"] == owner["user"]["companyId"]
    _response_has_no_salary_grade(created)

    got = client.get(f"{_BASE}/{created['id']}", headers=_auth(owner))
    assert got.status_code == 200
    assert got.json()["data"]["id"] == created["id"]
    assert got.json()["data"]["salaryGrade"] == "G7"

    listed = client.get(_BASE, headers=_auth(owner))
    assert listed.status_code == 200
    payload = listed.json()["data"]
    assert any(item["id"] == created["id"] for item in payload["items"])
    for item in payload["items"]:
        _response_has_no_salary_grade(item)

    patched = client.patch(
        f"{_BASE}/{created['id']}",
        json={"department": "Platform", "status": "on_leave"},
        headers=_auth(owner),
    )
    assert patched.status_code == 200
    assert patched.json()["data"]["department"] == "Platform"
    assert patched.json()["data"]["status"] == "on_leave"

    archived = client.delete(f"{_BASE}/{created['id']}", headers=_auth(owner))
    assert archived.status_code == 200

    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(owner)).status_code == 404


# ---------------------------------------------------------------------------
# Tenant isolation
# ---------------------------------------------------------------------------


def test_tenant_a_list_excludes_tenant_b(client):
    a = _register(client, "lista")
    b = _register(client, "listb")
    a_emp = _create_employee(client, a, employeeNumber="A-ONLY")
    b_emp = _create_employee(client, b, employeeNumber="B-ONLY")

    a_ids = {item["id"] for item in client.get(_BASE, headers=_auth(a)).json()["data"]["items"]}
    b_ids = {item["id"] for item in client.get(_BASE, headers=_auth(b)).json()["data"]["items"]}
    assert a_emp["id"] in a_ids and b_emp["id"] not in a_ids
    assert b_emp["id"] in b_ids and a_emp["id"] not in b_ids


def test_tenant_a_get_tenant_b_employee_is_404(client):
    a = _register(client, "geta")
    b = _register(client, "getb")
    b_emp = _create_employee(client, b, employeeNumber="SECRET")

    res = client.get(f"{_BASE}/{b_emp['id']}", headers=_auth(a))
    assert res.status_code == 404
    assert "another" not in res.json()["message"].lower()


def test_tenant_a_patch_tenant_b_employee_is_404(client):
    a = _register(client, "patcha")
    b = _register(client, "patchb")
    b_emp = _create_employee(client, b, employeeNumber="IMMUTABLE")

    res = client.patch(
        f"{_BASE}/{b_emp['id']}",
        json={"department": "Hijacked"},
        headers=_auth(a),
    )
    assert res.status_code == 404

    still = client.get(f"{_BASE}/{b_emp['id']}", headers=_auth(b))
    assert still.json()["data"]["department"] is None


def test_tenant_a_archive_tenant_b_employee_is_404(client):
    a = _register(client, "archa")
    b = _register(client, "archb")
    b_emp = _create_employee(client, b, employeeNumber="STAY")

    assert client.delete(f"{_BASE}/{b_emp['id']}", headers=_auth(a)).status_code == 404
    assert client.get(f"{_BASE}/{b_emp['id']}", headers=_auth(b)).status_code == 200


def test_cross_tenant_user_link_rejected(client):
    a = _register(client, "linka")
    b = _register(client, "linkb")
    res = client.post(
        _BASE,
        json={
            "employeeNumber": "XT-LINK",
            "firstName": "Bad",
            "lastName": "Link",
            "userId": b["user"]["id"],
        },
        headers=_auth(a),
    )
    assert res.status_code == 422


def test_cross_tenant_manager_rejected(client):
    a = _register(client, "mgra")
    b = _register(client, "mgrb")
    b_mgr = _create_employee(
        client,
        b,
        employeeNumber="B-MGR",
        firstName="B",
        lastName="Manager",
    )
    res = client.post(
        _BASE,
        json={
            "employeeNumber": "BAD-MGR",
            "firstName": "Bad",
            "lastName": "Report",
            "managerId": b_mgr["id"],
        },
        headers=_auth(a),
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------


def test_rbac_owner_full_crud(client):
    owner = _register(client, "ownercrud")
    created = _create_employee(client, owner, employeeNumber="OWN-1")
    assert client.get(_BASE, headers=_auth(owner)).status_code == 200
    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(owner)).status_code == 200
    assert (
        client.patch(
            f"{_BASE}/{created['id']}",
            json={"department": "Ops"},
            headers=_auth(owner),
        ).status_code
        == 200
    )
    assert client.delete(f"{_BASE}/{created['id']}", headers=_auth(owner)).status_code == 200


def test_rbac_admin_full_crud(client):
    owner = _register(client, "admincrud")
    _set_user_role(owner["user"]["id"], "Admin")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    created = client.post(
        _BASE,
        json={"employeeNumber": "ADM-1", "firstName": "A", "lastName": "D"},
        headers=headers,
    )
    assert created.status_code == 201
    emp_id = created.json()["data"]["id"]
    assert client.get(_BASE, headers=headers).status_code == 200
    assert client.patch(f"{_BASE}/{emp_id}", json={"department": "HR"}, headers=headers).status_code == 200
    assert client.delete(f"{_BASE}/{emp_id}", headers=headers).status_code == 200


def test_rbac_manager_company_directory_denied(client):
    owner = _register(client, "mgrdir")
    _create_employee(client, owner, employeeNumber="OTHER-1", firstName="Other", lastName="Person")
    mgr = _create_employee(
        client,
        owner,
        employeeNumber="MGR-1",
        userId=owner["user"]["id"],
        firstName="Mgr",
        lastName="Boss",
    )
    _create_employee(
        client,
        owner,
        employeeNumber="DR-1",
        firstName="Direct",
        lastName="Report",
        managerId=mgr["id"],
    )

    _set_user_role(owner["user"]["id"], "Manager")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    items = client.get(_BASE, headers=headers).json()["data"]["items"]
    ids = {item["id"] for item in items}
    assert mgr["id"] in ids
    assert any(item["employeeNumber"] == "DR-1" for item in items)
    assert all(item["employeeNumber"] != "OTHER-1" for item in items)


def test_rbac_manager_unrelated_employee_denied(client):
    owner = _register(client, "mgrunrel")
    unrelated = _create_employee(
        client, owner, employeeNumber="UNREL", firstName="Un", lastName="Related"
    )
    _create_employee(
        client,
        owner,
        employeeNumber="MGR-U",
        userId=owner["user"]["id"],
        firstName="Mgr",
        lastName="Only",
    )

    _set_user_role(owner["user"]["id"], "Manager")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    assert client.get(f"{_BASE}/{unrelated['id']}", headers=headers).status_code == 404


def test_rbac_manager_compensation_denied(client):
    owner = _register(client, "mgrcomp")
    mgr = _create_employee(
        client,
        owner,
        employeeNumber="MC-MGR",
        userId=owner["user"]["id"],
        salaryGrade="G9",
    )
    report = _create_employee(
        client,
        owner,
        employeeNumber="MC-DR",
        managerId=mgr["id"],
        salaryGrade="G3",
    )

    _set_user_role(owner["user"]["id"], "Manager")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    listed = client.get(_BASE, headers=headers).json()["data"]["items"]
    for item in listed:
        _response_has_no_salary_grade(item)

    detail = client.get(f"{_BASE}/{report['id']}", headers=headers)
    assert detail.status_code == 200
    _response_has_no_salary_grade(detail.json()["data"])


def test_rbac_employee_own_record_allowed(client):
    owner = _register(client, "empown")
    mine = _create_employee(
        client,
        owner,
        employeeNumber="SELF-1",
        userId=owner["user"]["id"],
        salaryGrade="G4",
    )
    other = _create_employee(client, owner, employeeNumber="OTHER-E", firstName="O", lastName="T")

    _set_user_role(owner["user"]["id"], "Employee")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    listed = client.get(_BASE, headers=headers).json()["data"]["items"]
    assert len(listed) == 1
    assert listed[0]["id"] == mine["id"]

    own = client.get(f"{_BASE}/{mine['id']}", headers=headers)
    assert own.status_code == 200
    assert own.json()["data"]["salaryGrade"] == "G4"
    assert client.get(f"{_BASE}/{other['id']}", headers=headers).status_code == 404


def test_rbac_viewer_denied(client):
    owner = _register(client, "viewdeny")
    _create_employee(client, owner, employeeNumber="V-1")

    _set_user_role(owner["user"]["id"], "Viewer")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    assert client.get(_BASE, headers=headers).status_code == 403
    assert (
        client.post(
            _BASE,
            json={"employeeNumber": "NOPE", "firstName": "N", "lastName": "O"},
            headers=headers,
        ).status_code
        == 403
    )


def test_unauthenticated_rejected(client):
    assert client.get(_BASE).status_code == 401
    assert client.post(_BASE, json={"employeeNumber": "X"}).status_code == 401


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------


def test_hr_only_employee_succeeds(client):
    owner = _register(client, "hronly")
    res = client.post(
        _BASE,
        json={
            "employeeNumber": "HR-ONLY-1",
            "firstName": "No",
            "lastName": "Login",
            "workEmail": "nologin@example.com",
        },
        headers=_auth(owner),
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["userId"] is None
    assert data["firstName"] == "No"


def test_hr_only_missing_identity_rejected(client):
    owner = _register(client, "hrmiss")
    res = client.post(
        _BASE,
        json={"employeeNumber": "HR-BAD"},
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_linked_employee_succeeds(client):
    owner = _register(client, "linked")
    res = client.post(
        _BASE,
        json={
            "employeeNumber": "LINK-1",
            "userId": owner["user"]["id"],
        },
        headers=_auth(owner),
    )
    assert res.status_code == 201
    assert res.json()["data"]["userId"] == owner["user"]["id"]


def test_duplicate_live_user_employee_rejected(client):
    owner = _register(client, "duplink")
    _create_employee(
        client,
        owner,
        employeeNumber="DUP-1",
        userId=owner["user"]["id"],
    )
    res = client.post(
        _BASE,
        json={"employeeNumber": "DUP-2", "userId": owner["user"]["id"]},
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_duplicate_employee_number_rejected(client):
    owner = _register(client, "dupnum")
    _create_employee(client, owner, employeeNumber="NUM-X", firstName="One", lastName="A")
    res = client.post(
        _BASE,
        json={"employeeNumber": "NUM-X", "firstName": "Two", "lastName": "B"},
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_create_mass_assignment_protected_fields_ignored(client):
    owner = _register(client, "massc")
    forged_id = str(uuid.uuid4())
    res = client.post(
        _BASE,
        json={
            "employeeNumber": "MASS-1",
            "firstName": "Mass",
            "lastName": "Safe",
            "id": forged_id,
            "companyId": str(uuid.uuid4()),
            "createdBy": str(uuid.uuid4()),
            "deletedAt": "2020-01-01T00:00:00Z",
        },
        headers=_auth(owner),
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["id"] != forged_id
    assert data["companyId"] == owner["user"]["companyId"]
    assert data["deletedAt"] is None


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def test_update_unlink_user_succeeds(client):
    owner = _register(client, "unlink")
    created = _create_employee(
        client,
        owner,
        employeeNumber="UNL-1",
        userId=owner["user"]["id"],
        firstName="Keep",
        lastName="Name",
    )
    res = client.patch(
        f"{_BASE}/{created['id']}",
        json={"userId": None},
        headers=_auth(owner),
    )
    assert res.status_code == 200
    assert res.json()["data"]["userId"] is None


def test_update_manager_self_assignment_rejected(client):
    owner = _register(client, "selfmgr")
    created = _create_employee(
        client, owner, employeeNumber="SM-1", firstName="Self", lastName="Mgr"
    )
    res = client.patch(
        f"{_BASE}/{created['id']}",
        json={"managerId": created["id"]},
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_update_manager_cycle_rejected(client):
    owner = _register(client, "cycle")
    c = _create_employee(client, owner, employeeNumber="CYC-C", firstName="C", lastName="Bot")
    b = _create_employee(
        client, owner, employeeNumber="CYC-B", firstName="B", lastName="Mid", managerId=c["id"]
    )
    a = _create_employee(
        client, owner, employeeNumber="CYC-A", firstName="A", lastName="Top", managerId=b["id"]
    )
    res = client.patch(
        f"{_BASE}/{c['id']}",
        json={"managerId": a["id"]},
        headers=_auth(owner),
    )
    assert res.status_code == 422


def test_department_updates_employee_only(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import User

    owner = _register(client, "dept")
    _create_employee(
        client,
        owner,
        employeeNumber="DEPT-1",
        userId=owner["user"]["id"],
        department="HR Dept",
    )

    async def _check_user_dept():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                user = (
                    await db.execute(
                        select(User.department).where(User.id == uuid.UUID(owner["user"]["id"]))
                    )
                ).scalar_one()
                return user
        finally:
            await engine.dispose()

    assert asyncio.run(_check_user_dept()) is None


def test_update_mass_assignment_protected_fields_ignored(client):
    owner = _register(client, "massu")
    created = _create_employee(client, owner, employeeNumber="MU-1", firstName="A", lastName="B")
    res = client.patch(
        f"{_BASE}/{created['id']}",
        json={
            "department": "New Dept",
            "companyId": str(uuid.uuid4()),
            "deletedAt": "2020-01-01T00:00:00Z",
        },
        headers=_auth(owner),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["department"] == "New Dept"
    assert data["companyId"] == owner["user"]["companyId"]
    assert data["deletedAt"] is None


# ---------------------------------------------------------------------------
# Archive
# ---------------------------------------------------------------------------


def test_archive_soft_delete_and_user_intact(client):
    import asyncio

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.models import Employee, User

    owner = _register(client, "archsoft")
    created = _create_employee(
        client,
        owner,
        employeeNumber="ARCH-1",
        userId=owner["user"]["id"],
    )
    assert client.delete(f"{_BASE}/{created['id']}", headers=_auth(owner)).status_code == 200
    assert client.get(f"{_BASE}/{created['id']}", headers=_auth(owner)).status_code == 404

    async def _check():
        engine = create_async_engine(TEST_DB, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with session_factory() as db:
                user = (
                    await db.execute(
                        select(User.id).where(User.id == uuid.UUID(owner["user"]["id"]))
                    )
                ).scalar_one_or_none()
                emp = (
                    await db.execute(
                        select(Employee.deleted_at).where(Employee.id == uuid.UUID(created["id"]))
                    )
                ).scalar_one()
                return user, emp
        finally:
            await engine.dispose()

    user_id, deleted_at = asyncio.run(_check())
    assert user_id is not None
    assert deleted_at is not None


def test_rehire_after_archive_reuses_number(client):
    owner = _register(client, "rehire")
    number = "REH-001"
    first = _create_employee(
        client,
        owner,
        employeeNumber=number,
        userId=owner["user"]["id"],
        firstName="First",
        lastName="Hire",
    )
    assert client.delete(f"{_BASE}/{first['id']}", headers=_auth(owner)).status_code == 200

    second = client.post(
        _BASE,
        json={
            "employeeNumber": number,
            "userId": owner["user"]["id"],
            "firstName": "Second",
            "lastName": "Hire",
        },
        headers=_auth(owner),
    )
    assert second.status_code == 201
    assert second.json()["data"]["employeeNumber"] == number


# ---------------------------------------------------------------------------
# Sensitive data — HTTP serialization
# ---------------------------------------------------------------------------


def test_list_never_includes_salary_grade(client):
    owner = _register(client, "nolistcomp")
    _create_employee(
        client,
        owner,
        employeeNumber="NC-1",
        salaryGrade="G8",
    )
    res = client.get(_BASE, headers=_auth(owner))
    assert res.status_code == 200
    for item in res.json()["data"]["items"]:
        _response_has_no_salary_grade(item)


def test_unauthorized_caller_cannot_obtain_salary_grade(client):
    owner = _register(client, "nocomp")
    mgr = _create_employee(
        client,
        owner,
        employeeNumber="NC-M",
        userId=owner["user"]["id"],
        salaryGrade="G9",
    )
    report = _create_employee(
        client,
        owner,
        employeeNumber="NC-R",
        managerId=mgr["id"],
        salaryGrade="G2",
    )

    _set_user_role(owner["user"]["id"], "Manager")
    headers = _login(
        client, owner["email"], owner["password"], owner["user"]["companySlug"]
    )
    detail = client.get(f"{_BASE}/{report['id']}", headers=headers)
    assert detail.status_code == 200
    _response_has_no_salary_grade(detail.json()["data"])


# ---------------------------------------------------------------------------
# Pagination / search / filters
# ---------------------------------------------------------------------------


def test_pagination_and_search(client):
    owner = _register(client, "page")
    _create_employee(
        client, owner, employeeNumber="SRCH-1", firstName="Alpha", lastName="Searchable"
    )
    _create_employee(
        client, owner, employeeNumber="SRCH-2", firstName="Beta", lastName="Other"
    )

    page1 = client.get(
        _BASE, params={"page": 1, "pageSize": 1}, headers=_auth(owner)
    )
    assert page1.status_code == 200
    assert len(page1.json()["data"]["items"]) == 1
    assert page1.json()["data"]["meta"]["total"] >= 2

    found = client.get(_BASE, params={"search": "searchable"}, headers=_auth(owner))
    assert any(item["lastName"] == "Searchable" for item in found.json()["data"]["items"])


def test_status_filter(client):
    owner = _register(client, "statfilt")
    active = _create_employee(
        client, owner, employeeNumber="ST-A", status="active"
    )
    leave = _create_employee(
        client, owner, employeeNumber="ST-L", status="on_leave"
    )

    res = client.get(_BASE, params={"status": "on_leave"}, headers=_auth(owner))
    ids = {item["id"] for item in res.json()["data"]["items"]}
    assert leave["id"] in ids
    assert active["id"] not in ids
