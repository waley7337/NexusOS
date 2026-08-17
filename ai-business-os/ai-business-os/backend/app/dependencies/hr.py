"""HR FastAPI dependency helpers — trusted tenant context → repositories."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.db.session import get_db
from app.hr.authorization import (
    EMPLOYEES_READ,
    EMPLOYEES_READ_SELF,
    EMPLOYEES_READ_TEAM,
)
from app.repositories.hr import EmployeeRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_employee_repository(
    db: DbSession,
    user: ActiveUser,
) -> EmployeeRepository:
    return EmployeeRepository(db, company_id=user.company_id, user_id=user.id)


EmployeeRepo = Annotated[EmployeeRepository, Depends(get_employee_repository)]


def require_employee_read_access():
    """Allow list/detail when caller holds any scoped Employee read permission."""

    async def checker(user: ActiveUser) -> CurrentUser:
        if user.permissions & {EMPLOYEES_READ, EMPLOYEES_READ_SELF, EMPLOYEES_READ_TEAM}:
            return user
        raise ForbiddenError()

    return checker


EmployeeReadUser = Annotated[CurrentUser, Depends(require_employee_read_access())]
