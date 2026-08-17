"""EmployeeRepository and HR schema authorization tests."""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import delete  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.core.exceptions import TenantIsolationError, ValidationError  # noqa: E402
from app.hr.authorization import (  # noqa: E402
    EMPLOYEES_READ,
    EMPLOYEES_READ_COMPENSATION,
    EMPLOYEES_READ_SELF,
    EMPLOYEES_READ_TEAM,
    can_read_employee_record,
    can_view_compensation,
)
from app.models import Company, Employee, User  # noqa: E402
from app.models.enums import EmployeeStatus, EmploymentType, UserStatus  # noqa: E402
from app.repositories.hr import EmployeeRepository  # noqa: E402
from app.schemas.hr import (  # noqa: E402
    EmployeeCompensationResponse,
    EmployeeResponse,
    employee_to_authorized_response,
    employee_to_response,
)


@pytest_asyncio.fixture
async def hr_fixture():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        company = Company(name="Repo Co", slug=f"repo-{os.urandom(4).hex()}")
        db.add(company)
        await db.flush()

        user = User(
            company_id=company.id,
            first_name="Repo",
            last_name="User",
            email=f"repo-{os.urandom(4).hex()}@example.com",
            password_hash="x",
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.flush()

        yield db, company, user

        await db.execute(delete(Employee).where(Employee.company_id == company.id))
        await db.execute(delete(User).where(User.company_id == company.id))
        await db.delete(company)
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_repository_requires_identity_for_hr_only():
    with pytest.raises(ValidationError, match="First name and last name"):
        EmployeeRepository.validate_identity_fields(
            user_id=None, first_name=None, last_name="Only"
        )


@pytest.mark.asyncio
async def test_repository_rejects_cross_tenant_user_link(hr_fixture):
    db, company, user = hr_fixture

    other = Company(name="Other", slug=f"other-{os.urandom(4).hex()}")
    db.add(other)
    await db.flush()
    outsider = User(
        company_id=other.id,
        first_name="Out",
        last_name="Side",
        email=f"out-{os.urandom(4).hex()}@example.com",
        password_hash="x",
        status=UserStatus.ACTIVE,
    )
    db.add(outsider)
    await db.flush()

    repo = EmployeeRepository(db, company_id=company.id)
    with pytest.raises(ValidationError, match="current company"):
        await repo.ensure_user_linkable(outsider.id)

    await db.delete(outsider)
    await db.delete(other)
    await db.commit()


@pytest.mark.asyncio
async def test_repository_mass_assignment_protected(hr_fixture):
    db, company, user = hr_fixture
    repo = EmployeeRepository(db, company_id=company.id, user_id=user.id)

    emp = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="M",
        last_name="A",
        employee_number=f"MA-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    await repo.create(emp)

    with pytest.raises(ValidationError, match="protected field"):
        await repo.update(emp.id, {"company_id": uuid.uuid4()})

    await db.delete(emp)
    await db.commit()


@pytest.mark.asyncio
async def test_repository_tenant_isolation_fail_closed(hr_fixture):
    db, company, _user = hr_fixture
    repo = EmployeeRepository(db, company_id=None)
    with pytest.raises(TenantIsolationError):
        await repo.list()


@pytest.mark.asyncio
async def test_public_response_excludes_salary_grade(hr_fixture):
    db, company, user = hr_fixture
    emp = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="Pub",
        last_name="Lic",
        employee_number=f"P-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G7",
    )
    db.add(emp)
    await db.flush()

    public = employee_to_response(emp, linked_user=user)
    assert "salaryGrade" not in public.model_dump(by_alias=True)
    assert "salary_grade" not in public.model_dump(by_alias=False)

    owner_view = employee_to_authorized_response(
        emp,
        permissions={EMPLOYEES_READ_COMPENSATION},
        acting_user_id=user.id,
        linked_user=user,
    )
    assert owner_view.salary_grade == "G7"

    manager_view = employee_to_authorized_response(
        emp,
        permissions={EMPLOYEES_READ_TEAM, EMPLOYEES_READ_SELF},
        acting_user_id=uuid.uuid4(),
        linked_user=user,
    )
    assert isinstance(manager_view, EmployeeResponse)
    assert not isinstance(manager_view, EmployeeCompensationResponse)

    self_view = employee_to_authorized_response(
        emp,
        permissions={EMPLOYEES_READ_SELF},
        acting_user_id=user.id,
        linked_user=user,
    )
    assert self_view.salary_grade == "G7"

    await db.delete(emp)
    await db.commit()


def test_manager_default_denied_compensation():
    perms = {EMPLOYEES_READ_TEAM, EMPLOYEES_READ_SELF}
    emp = Employee(
        company_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        first_name="E",
        last_name="E",
        employee_number="1",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G2",
    )
    assert not can_view_compensation(
        permissions=perms,
        acting_user_id=uuid.uuid4(),
        employee=emp,
    )


def test_employee_self_compensation_only_for_own_record():
    user_id = uuid.uuid4()
    own = Employee(
        company_id=uuid.uuid4(),
        user_id=user_id,
        first_name="Self",
        last_name="User",
        employee_number="1",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G1",
    )
    other = Employee(
        company_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        first_name="Other",
        last_name="User",
        employee_number="2",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G9",
    )
    perms = {EMPLOYEES_READ_SELF}
    assert can_view_compensation(permissions=perms, acting_user_id=user_id, employee=own)
    assert not can_view_compensation(
        permissions=perms, acting_user_id=user_id, employee=other
    )


def test_team_read_does_not_imply_compensation():
    manager_id = uuid.uuid4()
    emp = Employee(
        company_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        first_name="Rep",
        last_name="ort",
        employee_number="1",
        manager_id=manager_id,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    perms = {EMPLOYEES_READ_TEAM}
    assert can_read_employee_record(
        permissions=perms,
        acting_user_id=uuid.uuid4(),
        employee=emp,
        caller_employee_id=manager_id,
    )
    assert not can_view_compensation(
        permissions=perms,
        acting_user_id=uuid.uuid4(),
        employee=emp,
    )


def test_company_read_includes_directory_not_compensation():
    emp = Employee(
        company_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        first_name="Dir",
        last_name="Ectory",
        employee_number="1",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G4",
    )
    perms = {EMPLOYEES_READ}
    assert can_read_employee_record(
        permissions=perms,
        acting_user_id=uuid.uuid4(),
        employee=emp,
        caller_employee_id=None,
    )
    assert not can_view_compensation(
        permissions=perms,
        acting_user_id=uuid.uuid4(),
        employee=emp,
    )
