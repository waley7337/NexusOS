"""HR Employee schema integrity — cross-tenant FKs, optional user, rehire."""
from __future__ import annotations

import os
from datetime import datetime, timezone

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.models import Company, Employee, User  # noqa: E402
from app.models.enums import EmployeeStatus, EmploymentType, UserStatus  # noqa: E402


@pytest_asyncio.fixture
async def tenant_with_user():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        company = Company(name="HR Co A", slug=f"hr-a-{os.urandom(4).hex()}")
        db.add(company)
        await db.flush()
        company_id = company.id

        user = User(
            company_id=company_id,
            first_name="Alex",
            last_name="Worker",
            email=f"alex-{os.urandom(4).hex()}@example.com",
            password_hash="x",
            status=UserStatus.ACTIVE,
        )
        db.add(user)
        await db.commit()

        yield db, company, user

        await db.execute(delete(Employee).where(Employee.company_id == company_id))
        await db.execute(delete(User).where(User.company_id == company_id))
        await db.execute(delete(Company).where(Company.id == company_id))
        await db.commit()
    await engine.dispose()


@pytest_asyncio.fixture
async def two_tenants_with_users():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        a = Company(name="Tenant A", slug=f"hr-xt-a-{os.urandom(4).hex()}")
        b = Company(name="Tenant B", slug=f"hr-xt-b-{os.urandom(4).hex()}")
        db.add_all([a, b])
        await db.flush()
        a_id, b_id = a.id, b.id

        ua = User(
            company_id=a_id,
            first_name="A",
            last_name="User",
            email=f"a-{os.urandom(4).hex()}@example.com",
            password_hash="x",
            status=UserStatus.ACTIVE,
        )
        ub = User(
            company_id=b_id,
            first_name="B",
            last_name="User",
            email=f"b-{os.urandom(4).hex()}@example.com",
            password_hash="x",
            status=UserStatus.ACTIVE,
        )
        db.add_all([ua, ub])
        await db.flush()

        mgr = Employee(
            company_id=a_id,
            user_id=ua.id,
            first_name="A",
            last_name="User",
            employee_number=f"EMP-{os.urandom(2).hex()}",
            employment_type=EmploymentType.FULL_TIME,
            status=EmployeeStatus.ACTIVE,
        )
        db.add(mgr)
        await db.commit()

        yield db, a, b, ua, ub, mgr

        await db.execute(delete(Employee).where(Employee.company_id.in_([a_id, b_id])))
        await db.execute(delete(User).where(User.company_id.in_([a_id, b_id])))
        await db.execute(delete(Company).where(Company.id.in_([a_id, b_id])))
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_hr_only_employee_without_user(tenant_with_user):
    db, company, _user = tenant_with_user
    emp = Employee(
        company_id=company.id,
        user_id=None,
        first_name="No",
        last_name="Login",
        employee_number=f"NL-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(emp)
    await db.flush()
    assert emp.id is not None
    await db.delete(emp)
    await db.commit()


@pytest.mark.asyncio
async def test_linked_employee_same_tenant(tenant_with_user):
    db, company, user = tenant_with_user
    emp = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_number=f"LN-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G5",
    )
    db.add(emp)
    await db.flush()
    assert emp.user_id == user.id
    await db.delete(emp)
    await db.commit()


@pytest.mark.asyncio
async def test_cross_tenant_user_link_rejected(two_tenants_with_users):
    db, a, _b, _ua, ub, _mgr = two_tenants_with_users
    forged = Employee(
        company_id=a.id,
        user_id=ub.id,
        first_name="Cross",
        last_name="Tenant",
        employee_number=f"XT-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_cross_tenant_manager_rejected(two_tenants_with_users):
    db, a, b, ua, ub, _mgr_a = two_tenants_with_users

    mgr_b = Employee(
        company_id=b.id,
        user_id=ub.id,
        first_name="B",
        last_name="Mgr",
        employee_number=f"MB-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(mgr_b)
    await db.flush()

    forged = Employee(
        company_id=a.id,
        user_id=ua.id,
        first_name="Bad",
        last_name="Report",
        employee_number=f"BR-{os.urandom(2).hex()}",
        manager_id=mgr_b.id,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_duplicate_live_user_employee_rejected(tenant_with_user):
    db, company, user = tenant_with_user
    first = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="One",
        last_name="Link",
        employee_number=f"D1-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(first)
    await db.commit()

    second = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="Two",
        last_name="Link",
        employee_number=f"D2-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(second)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_employee_number_unique_among_live_rows(tenant_with_user):
    db, company, user = tenant_with_user
    number = f"NUM-{os.urandom(2).hex()}"
    first = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="N",
        last_name="One",
        employee_number=number,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(first)
    await db.commit()

    second = Employee(
        company_id=company.id,
        user_id=None,
        first_name="N",
        last_name="Two",
        employee_number=number,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(second)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_soft_delete_frees_user_and_number_for_rehire(tenant_with_user):
    db, company, user = tenant_with_user
    number = f"RH-{os.urandom(2).hex()}"
    first = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="Re",
        last_name="Hire",
        employee_number=number,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(first)
    await db.flush()
    first.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    second = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name="Re",
        last_name="Hire2",
        employee_number=number,
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
    )
    db.add(second)
    await db.flush()
    assert second.id is not None

    await db.delete(second)
    await db.delete(first)
    await db.commit()


@pytest.mark.asyncio
async def test_user_hard_delete_preserves_employee_and_unlinks(tenant_with_user):
    db, company, user = tenant_with_user
    emp = Employee(
        company_id=company.id,
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        employee_number=f"HD-{os.urandom(2).hex()}",
        employment_type=EmploymentType.FULL_TIME,
        status=EmployeeStatus.ACTIVE,
        salary_grade="G3",
    )
    db.add(emp)
    await db.flush()
    emp_id = emp.id
    user_id = user.id

    await db.execute(delete(User).where(User.id == user_id))
    await db.flush()
    db.expire_all()

    persisted = (
        await db.execute(select(Employee).where(Employee.id == emp_id))
    ).scalar_one()
    assert persisted.user_id is None
    assert persisted.salary_grade == "G3"

    await db.delete(persisted)
    await db.commit()
