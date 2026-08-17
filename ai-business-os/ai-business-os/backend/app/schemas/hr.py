"""HR request/response schemas — Part 07.1 foundation.

Create/Update omit system/ownership fields. Public responses exclude
compensation-sensitive columns (``salary_grade``). Compensation is exposed
only through ``EmployeeCompensationResponse`` when authorization allows.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import AbstractSet

from pydantic import EmailStr, Field

from app.hr.authorization import can_view_compensation
from app.models.enums import EmployeeStatus, EmploymentType
from app.models.hr import Employee
from app.models.user import User
from app.schemas.base import CamelModel


class EmployeeCreate(CamelModel):
    user_id: uuid.UUID | None = Field(default=None, alias="userId")
    first_name: str | None = Field(default=None, alias="firstName", max_length=100)
    last_name: str | None = Field(default=None, alias="lastName", max_length=100)
    work_email: EmailStr | None = Field(default=None, alias="workEmail")
    employee_number: str = Field(alias="employeeNumber", min_length=1, max_length=40)
    department: str | None = Field(default=None, max_length=120)
    manager_id: uuid.UUID | None = Field(default=None, alias="managerId")
    hire_date: date | None = Field(default=None, alias="hireDate")
    salary_grade: str | None = Field(default=None, alias="salaryGrade", max_length=20)
    employment_type: EmploymentType = Field(
        default=EmploymentType.FULL_TIME, alias="employmentType"
    )
    status: EmployeeStatus = EmployeeStatus.ACTIVE


class EmployeeUpdate(CamelModel):
    user_id: uuid.UUID | None = Field(default=None, alias="userId")
    first_name: str | None = Field(default=None, alias="firstName", max_length=100)
    last_name: str | None = Field(default=None, alias="lastName", max_length=100)
    work_email: EmailStr | None = Field(default=None, alias="workEmail")
    employee_number: str | None = Field(default=None, alias="employeeNumber", max_length=40)
    department: str | None = Field(default=None, max_length=120)
    manager_id: uuid.UUID | None = Field(default=None, alias="managerId")
    hire_date: date | None = Field(default=None, alias="hireDate")
    salary_grade: str | None = Field(default=None, alias="salaryGrade", max_length=20)
    employment_type: EmploymentType | None = Field(default=None, alias="employmentType")
    status: EmployeeStatus | None = None


class EmployeeResponse(CamelModel):
    """Ordinary employee directory payload — no compensation fields."""

    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    user_id: uuid.UUID | None = Field(default=None, alias="userId")
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    full_name: str = Field(alias="fullName")
    work_email: str | None = Field(default=None, alias="workEmail")
    employee_number: str = Field(alias="employeeNumber")
    department: str | None = None
    manager_id: uuid.UUID | None = Field(default=None, alias="managerId")
    hire_date: date | None = Field(default=None, alias="hireDate")
    employment_type: EmploymentType = Field(alias="employmentType")
    status: EmployeeStatus
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


class EmployeeCompensationResponse(EmployeeResponse):
    """Extends public employee data with compensation-sensitive fields."""

    salary_grade: str | None = Field(default=None, alias="salaryGrade")


def _resolve_display_names(
    employee: Employee,
    linked_user: User | None,
) -> tuple[str, str, str | None]:
    first = (employee.first_name or "").strip()
    last = (employee.last_name or "").strip()
    if linked_user is not None:
        if not first:
            first = linked_user.first_name
        if not last:
            last = linked_user.last_name
    if not first or not last:
        raise ValueError("Employee record is missing display identity.")
    work_email = employee.work_email
    if work_email is None and linked_user is not None:
        work_email = linked_user.email
    return first, last, work_email


def employee_to_response(
    employee: Employee,
    *,
    linked_user: User | None = None,
) -> EmployeeResponse:
    first, last, work_email = _resolve_display_names(employee, linked_user)
    return EmployeeResponse(
        id=employee.id,
        companyId=employee.company_id,
        userId=employee.user_id,
        firstName=first,
        lastName=last,
        fullName=f"{first} {last}",
        workEmail=work_email,
        employeeNumber=employee.employee_number,
        department=employee.department,
        managerId=employee.manager_id,
        hireDate=employee.hire_date,
        employmentType=employee.employment_type,
        status=employee.status,
        isActive=employee.is_active,
        createdAt=employee.created_at,
        updatedAt=employee.updated_at,
        createdBy=employee.created_by,
        updatedBy=employee.updated_by,
        deletedAt=employee.deleted_at,
    )


def employee_to_authorized_response(
    employee: Employee,
    *,
    permissions: AbstractSet[str],
    acting_user_id: uuid.UUID,
    linked_user: User | None = None,
) -> EmployeeResponse | EmployeeCompensationResponse:
    base = employee_to_response(employee, linked_user=linked_user)
    if can_view_compensation(
        permissions=permissions,
        acting_user_id=acting_user_id,
        employee=employee,
    ):
        return EmployeeCompensationResponse(
            **base.model_dump(),
            salaryGrade=employee.salary_grade,
        )
    return base
