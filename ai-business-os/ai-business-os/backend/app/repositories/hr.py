"""HR repositories — tenant-scoped Employee, leave, and attendance access."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List

from sqlalchemy import func, or_, select

from app.core.exceptions import NotFoundError, ValidationError
from app.models.enums import ApprovalStatus, EmployeeStatus, EmploymentType, LeaveType
from app.models.hr import Attendance, Employee, LeaveRequest
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

    async def get_live(self, employee_id: uuid.UUID) -> Employee:
        """Fetch a live in-tenant employee or raise NotFoundError."""
        return await self.get(employee_id)


class LeaveRequestRepository(BaseRepository[LeaveRequest]):
    model = LeaveRequest
    SORT_FIELDS = {
        "created_at": LeaveRequest.created_at,
        "start_date": LeaveRequest.start_date,
        "end_date": LeaveRequest.end_date,
        "approval_status": LeaveRequest.approval_status,
    }

    async def ensure_employee_in_tenant(self, employee_id: uuid.UUID) -> Employee:
        self._require_tenant_context()
        stmt = select(Employee).where(
            Employee.id == employee_id,
            Employee.company_id == self.company_id,
            Employee.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise ValidationError("Employee must belong to the current company.")
        return row

    @staticmethod
    def validate_dates(start: date, end: date) -> None:
        if end < start:
            raise ValidationError("End date must be on or after start date.")

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        employee_id: uuid.UUID | None = None,
        approval_status: ApprovalStatus | None = None,
        leave_type: LeaveType | None = None,
        visibility_employee_ids: list[uuid.UUID] | None = None,
    ) -> tuple[List[LeaveRequest], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if visibility_employee_ids is not None:
            if not visibility_employee_ids:
                return [], 0
            stmt = stmt.where(LeaveRequest.employee_id.in_(visibility_employee_ids))
        if employee_id is not None:
            stmt = stmt.where(LeaveRequest.employee_id == employee_id)
        if approval_status is not None:
            stmt = stmt.where(LeaveRequest.approval_status == approval_status)
        if leave_type is not None:
            stmt = stmt.where(LeaveRequest.leave_type == leave_type)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        else:
            stmt = stmt.order_by(LeaveRequest.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = list((await self.db.execute(stmt)).scalars().all())
        return rows, total

    async def set_approval_status(
        self,
        leave_id: uuid.UUID,
        status: ApprovalStatus,
    ) -> LeaveRequest:
        leave = await self.get(leave_id)
        if leave.approval_status != ApprovalStatus.PENDING:
            raise ValidationError("Only pending leave requests can be approved or rejected.")
        if status not in {ApprovalStatus.APPROVED, ApprovalStatus.REJECTED}:
            raise ValidationError("Approval status must be approved or rejected.")
        return await self.update(leave_id, {"approval_status": status})


class AttendanceRepository(BaseRepository[Attendance]):
    model = Attendance
    SORT_FIELDS = {
        "created_at": Attendance.created_at,
        "date": Attendance.date,
        "hours_worked": Attendance.hours_worked,
    }

    async def ensure_employee_in_tenant(self, employee_id: uuid.UUID) -> Employee:
        self._require_tenant_context()
        stmt = select(Employee).where(
            Employee.id == employee_id,
            Employee.company_id == self.company_id,
            Employee.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise ValidationError("Employee must belong to the current company.")
        return row

    async def get_for_employee_date(
        self, employee_id: uuid.UUID, on_date: date
    ) -> Attendance | None:
        stmt = self._base_query().where(
            Attendance.employee_id == employee_id,
            Attendance.date == on_date,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    def compute_hours(clock_in: datetime, clock_out: datetime) -> Decimal:
        if clock_out < clock_in:
            raise ValidationError("Clock-out must be on or after clock-in.")
        seconds = (clock_out - clock_in).total_seconds()
        hours = Decimal(str(round(seconds / 3600.0, 2)))
        if hours > Decimal("99.99"):
            raise ValidationError("Hours worked exceeds the allowed maximum.")
        return hours

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        employee_id: uuid.UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        visibility_employee_ids: list[uuid.UUID] | None = None,
    ) -> tuple[List[Attendance], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if visibility_employee_ids is not None:
            if not visibility_employee_ids:
                return [], 0
            stmt = stmt.where(Attendance.employee_id.in_(visibility_employee_ids))
        if employee_id is not None:
            stmt = stmt.where(Attendance.employee_id == employee_id)
        if date_from is not None:
            stmt = stmt.where(Attendance.date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Attendance.date <= date_to)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        else:
            stmt = stmt.order_by(Attendance.date.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = list((await self.db.execute(stmt)).scalars().all())
        return rows, total

    async def clock_in(self, employee_id: uuid.UUID, *, at: datetime | None = None) -> Attendance:
        now = at or datetime.now(timezone.utc)
        today = now.date()
        existing = await self.get_for_employee_date(employee_id, today)
        if existing is not None:
            if existing.clock_in is not None:
                raise ValidationError("Already clocked in for today.")
            return await self.update(existing.id, {"clock_in": now})
        return await self.create(
            Attendance(employee_id=employee_id, date=today, clock_in=now)
        )

    async def clock_out(self, employee_id: uuid.UUID, *, at: datetime | None = None) -> Attendance:
        now = at or datetime.now(timezone.utc)
        today = now.date()
        existing = await self.get_for_employee_date(employee_id, today)
        if existing is None or existing.clock_in is None:
            raise ValidationError("Clock in before clocking out.")
        if existing.clock_out is not None:
            raise ValidationError("Already clocked out for today.")
        hours = self.compute_hours(existing.clock_in, now)
        return await self.update(
            existing.id, {"clock_out": now, "hours_worked": hours}
        )
