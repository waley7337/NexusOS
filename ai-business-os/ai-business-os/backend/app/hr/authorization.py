"""HR authorization helpers — scope and compensation visibility (Part 07.1).

Used by repositories/schemas now; HTTP routes will reuse in 07.2.
"""

from __future__ import annotations

import uuid
from typing import AbstractSet

from app.models.hr import Employee

# Employee directory permissions (Part 07.1) + leave/attendance (07.4).
EMPLOYEES_READ = "employees.read"
EMPLOYEES_READ_COMPENSATION = "employees.read_compensation"
EMPLOYEES_READ_SELF = "employees.read_self"
EMPLOYEES_READ_TEAM = "employees.read_team"
EMPLOYEES_CREATE = "employees.create"
EMPLOYEES_UPDATE = "employees.update"
EMPLOYEES_DELETE = "employees.delete"

LEAVE_READ = "leave_requests.read"
LEAVE_READ_SELF = "leave_requests.read_self"
LEAVE_READ_TEAM = "leave_requests.read_team"
LEAVE_CREATE = "leave_requests.create"
LEAVE_APPROVE = "leave_requests.approve"

ATTENDANCE_READ = "attendance.read"
ATTENDANCE_READ_SELF = "attendance.read_self"
ATTENDANCE_READ_TEAM = "attendance.read_team"
ATTENDANCE_CLOCK = "attendance.clock"
ATTENDANCE_MANAGE = "attendance.manage"

EMPLOYEE_V1_PERMISSIONS: frozenset[str] = frozenset(
    {
        EMPLOYEES_READ,
        EMPLOYEES_READ_COMPENSATION,
        EMPLOYEES_READ_SELF,
        EMPLOYEES_READ_TEAM,
        EMPLOYEES_CREATE,
        EMPLOYEES_UPDATE,
        EMPLOYEES_DELETE,
    }
)


def caller_employee_id(employees: list[Employee], user_id: uuid.UUID) -> uuid.UUID | None:
    """Resolve the acting user's live Employee row within a tenant-scoped list."""
    for row in employees:
        if row.user_id == user_id and row.deleted_at is None:
            return row.id
    return None


def can_read_employee_record(
    *,
    permissions: AbstractSet[str],
    acting_user_id: uuid.UUID,
    employee: Employee,
    caller_employee_id: uuid.UUID | None,
    team_member_ids: AbstractSet[uuid.UUID] | None = None,
) -> bool:
    """Directory/team/self read authorization without trusting client ids."""
    if EMPLOYEES_READ in permissions:
        return True
    if (
        EMPLOYEES_READ_SELF in permissions
        and employee.user_id == acting_user_id
    ):
        return True
    if (
        EMPLOYEES_READ_TEAM in permissions
        and caller_employee_id is not None
        and employee.manager_id == caller_employee_id
    ):
        return True
    if team_member_ids is not None and employee.id in team_member_ids:
        return True
    return False


def can_view_compensation(
    *,
    permissions: AbstractSet[str],
    acting_user_id: uuid.UUID,
    employee: Employee,
) -> bool:
    """Compensation is never implied by directory read.

    * ``employees.read_compensation`` → company-wide (Owner/Admin).
    * ``employees.read_self`` → own record only (includes salary_grade for self).
    """
    if EMPLOYEES_READ_COMPENSATION in permissions:
        return True
    if (
        EMPLOYEES_READ_SELF in permissions
        and employee.user_id == acting_user_id
    ):
        return True
    return False


def can_access_employee_scoped_record(
    *,
    company_wide_perm: str,
    self_perm: str,
    team_perm: str,
    permissions: AbstractSet[str],
    employee: Employee,
    caller_employee_id: uuid.UUID | None,
    acting_user_id: uuid.UUID,
) -> bool:
    """Shared self/team/company gate for leave requests and attendance."""
    if company_wide_perm in permissions:
        return True
    if self_perm in permissions and employee.user_id == acting_user_id:
        return True
    if (
        team_perm in permissions
        and caller_employee_id is not None
        and employee.manager_id == caller_employee_id
    ):
        return True
    return False


def can_read_leave_for_employee(
    *,
    permissions: AbstractSet[str],
    employee: Employee,
    caller_employee_id: uuid.UUID | None,
    acting_user_id: uuid.UUID,
) -> bool:
    return can_access_employee_scoped_record(
        company_wide_perm=LEAVE_READ,
        self_perm=LEAVE_READ_SELF,
        team_perm=LEAVE_READ_TEAM,
        permissions=permissions,
        employee=employee,
        caller_employee_id=caller_employee_id,
        acting_user_id=acting_user_id,
    )


def can_approve_leave_for_employee(
    *,
    permissions: AbstractSet[str],
    employee: Employee,
    caller_employee_id: uuid.UUID | None,
) -> bool:
    if LEAVE_APPROVE not in permissions:
        return False
    if LEAVE_READ in permissions:
        return True
    return (
        caller_employee_id is not None
        and employee.manager_id == caller_employee_id
    )


def can_read_attendance_for_employee(
    *,
    permissions: AbstractSet[str],
    employee: Employee,
    caller_employee_id: uuid.UUID | None,
    acting_user_id: uuid.UUID,
) -> bool:
    return can_access_employee_scoped_record(
        company_wide_perm=ATTENDANCE_READ,
        self_perm=ATTENDANCE_READ_SELF,
        team_perm=ATTENDANCE_READ_TEAM,
        permissions=permissions,
        employee=employee,
        caller_employee_id=caller_employee_id,
        acting_user_id=acting_user_id,
    )
