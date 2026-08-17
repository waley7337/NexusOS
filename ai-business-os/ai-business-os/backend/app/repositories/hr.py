"""HR repositories — tenant-scoped Employee access (Part 07.1 foundation)."""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import func, or_, select

from app.core.exceptions import NotFoundError, ValidationError
from app.models.enums import EmployeeStatus, EmploymentType
from app.models.hr import Employee
from app.models.user import User
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository

_MAX_SEARCH_LEN = 100


def _ilike_contains(raw: str) -> str:
    escaped = (
        raw.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    return f"%{escaped}%"


class EmployeeRepository(BaseRepository[Employee]):
    model = Employee
    SORT_FIELDS = {
        "created_at": Employee.created_at,
        "employee_number": Employee.employee_number,
        "last_name": Employee.last_name,
        "status": Employee.status,
    }

    async def ensure_user_linkable(
        self,
        user_id: uuid.UUID,
        *,
        exclude_employee_id: uuid.UUID | None = None,
    ) -> None:
        """User must exist, be active in-tenant, and have no other live Employee."""
        self._require_tenant_context()
        stmt = select(User.id).where(
            User.id == user_id,
            User.company_id == self.company_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        found = (await self.db.execute(stmt)).scalar_one_or_none()
        if found is None:
            raise ValidationError("User must belong to the current company.")

        dup = select(Employee.id).where(
            Employee.company_id == self.company_id,
            Employee.user_id == user_id,
            Employee.deleted_at.is_(None),
        )
        if exclude_employee_id is not None:
            dup = dup.where(Employee.id != exclude_employee_id)
        if (await self.db.execute(dup)).scalar_one_or_none() is not None:
            raise ValidationError("User is already linked to an active employee record.")

    async def ensure_manager_in_tenant(self, manager_id: uuid.UUID) -> None:
        """Manager must be a live Employee in the same tenant."""
        self._require_tenant_context()
        stmt = select(Employee.id).where(
            Employee.id == manager_id,
            Employee.company_id == self.company_id,
            Employee.deleted_at.is_(None),
        )
        if (await self.db.execute(stmt)).scalar_one_or_none() is None:
            raise ValidationError("Manager must belong to the current company.")

    async def ensure_manager_assignment_valid(
        self,
        employee_id: uuid.UUID,
        manager_id: uuid.UUID,
    ) -> None:
        """Reject self-management and manager-chain cycles."""
        if employee_id == manager_id:
            raise ValidationError("Employee cannot be their own manager.")

        await self.ensure_manager_in_tenant(manager_id)

        visited: set[uuid.UUID] = set()
        current_id: uuid.UUID | None = manager_id
        while current_id is not None:
            if current_id == employee_id:
                raise ValidationError("Manager assignment would create a cycle.")
            if current_id in visited:
                break
            visited.add(current_id)
            row = (
                await self.db.execute(
                    select(Employee.manager_id).where(
                        Employee.id == current_id,
                        Employee.company_id == self.company_id,
                        Employee.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            current_id = row

    @staticmethod
    def validate_identity_fields(
        *,
        user_id: uuid.UUID | None,
        first_name: str | None,
        last_name: str | None,
    ) -> None:
        """HR-only employees (no user link) require explicit identity on Employee."""
        if user_id is not None:
            return
        if not (first_name and first_name.strip()) or not (last_name and last_name.strip()):
            raise ValidationError(
                "First name and last name are required for employees without a linked user."
            )

    async def get_by_user_id(self, user_id: uuid.UUID) -> Employee:
        stmt = self._base_query().where(Employee.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise NotFoundError("Employee not found")
        return row

    async def list_direct_reports(self, manager_employee_id: uuid.UUID) -> List[Employee]:
        stmt = self._base_query().where(Employee.manager_id == manager_employee_id)
        return list((await self.db.execute(stmt)).scalars().all())

    async def try_get_employee_id_for_user(self, user_id: uuid.UUID) -> uuid.UUID | None:
        stmt = select(Employee.id).where(
            Employee.company_id == self.company_id,
            Employee.user_id == user_id,
            Employee.deleted_at.is_(None),
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        search: str | None = None,
        manager_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        status: EmployeeStatus | None = None,
        employment_type: EmploymentType | None = None,
        visibility_manager_employee_id: uuid.UUID | None = None,
        visibility_user_id: uuid.UUID | None = None,
    ) -> tuple[List[Employee], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if visibility_manager_employee_id is not None or visibility_user_id is not None:
            visibility_clauses = []
            if visibility_manager_employee_id is not None:
                visibility_clauses.append(
                    Employee.manager_id == visibility_manager_employee_id
                )
            if visibility_user_id is not None:
                visibility_clauses.append(Employee.user_id == visibility_user_id)
            stmt = stmt.where(or_(*visibility_clauses))

        if manager_id is not None:
            stmt = stmt.where(Employee.manager_id == manager_id)
        if user_id is not None:
            stmt = stmt.where(Employee.user_id == user_id)
        if status is not None:
            stmt = stmt.where(Employee.status == status)
        if employment_type is not None:
            stmt = stmt.where(Employee.employment_type == employment_type)

        if search:
            term = search.strip()
            if len(term) > _MAX_SEARCH_LEN:
                raise ValidationError(
                    f"Search query must be at most {_MAX_SEARCH_LEN} characters."
                )
            if term:
                pattern = _ilike_contains(term)
                stmt = stmt.where(
                    or_(
                        Employee.first_name.ilike(pattern, escape="\\"),
                        Employee.last_name.ilike(pattern, escape="\\"),
                        Employee.employee_number.ilike(pattern, escape="\\"),
                        Employee.work_email.ilike(pattern, escape="\\"),
                        Employee.department.ilike(pattern, escape="\\"),
                    )
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        rows = list((await self.db.execute(stmt)).scalars().all())
        return rows, total
