"""HR FastAPI dependency helpers — trusted tenant context → repositories."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.db.session import get_db
from app.hr.authorization import (
    ATTENDANCE_READ,
    ATTENDANCE_READ_SELF,
    ATTENDANCE_READ_TEAM,
    EMPLOYEES_READ,
    EMPLOYEES_READ_SELF,
    EMPLOYEES_READ_TEAM,
    LEAVE_READ,
    LEAVE_READ_SELF,
    LEAVE_READ_TEAM,
)
from app.repositories.hr import (
    AttendanceRepository,
    EmployeeRepository,
    LeaveRequestRepository,
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_employee_repository(
    db: DbSession,
    user: ActiveUser,
) -> EmployeeRepository:
    return EmployeeRepository(db, company_id=user.company_id, user_id=user.id)


EmployeeRepo = Annotated[EmployeeRepository, Depends(get_employee_repository)]


def get_leave_repository(
    db: DbSession,
    user: ActiveUser,
) -> LeaveRequestRepository:
    return LeaveRequestRepository(db, company_id=user.company_id, user_id=user.id)


LeaveRepo = Annotated[LeaveRequestRepository, Depends(get_leave_repository)]


def get_attendance_repository(
    db: DbSession,
    user: ActiveUser,
) -> AttendanceRepository:
    return AttendanceRepository(db, company_id=user.company_id, user_id=user.id)


AttendanceRepo = Annotated[AttendanceRepository, Depends(get_attendance_repository)]


def require_employee_read_access():
    """Allow list/detail when caller holds any scoped Employee read permission."""

    async def checker(user: ActiveUser) -> CurrentUser:
        if user.permissions & {EMPLOYEES_READ, EMPLOYEES_READ_SELF, EMPLOYEES_READ_TEAM}:
            return user
        raise ForbiddenError()

    return checker


def require_leave_read_access():
    async def checker(user: ActiveUser) -> CurrentUser:
        if user.permissions & {LEAVE_READ, LEAVE_READ_SELF, LEAVE_READ_TEAM}:
            return user
        raise ForbiddenError()

    return checker


def require_attendance_read_access():
    async def checker(user: ActiveUser) -> CurrentUser:
        if user.permissions & {ATTENDANCE_READ, ATTENDANCE_READ_SELF, ATTENDANCE_READ_TEAM}:
            return user
        raise ForbiddenError()

    return checker


EmployeeReadUser = Annotated[CurrentUser, Depends(require_employee_read_access())]
LeaveReadUser = Annotated[CurrentUser, Depends(require_leave_read_access())]
AttendanceReadUser = Annotated[CurrentUser, Depends(require_attendance_read_access())]
