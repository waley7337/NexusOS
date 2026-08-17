"""HR: employees (employment identity), leave requests, attendance."""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint, Index, Numeric,
    String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin
from app.models.enums import (
    ApprovalStatus, EmployeeStatus, EmploymentType, LeaveType,
)

if TYPE_CHECKING:
    from app.models.user import User


class Employee(Base, TenantBusinessMixin):
    __tablename__ = "employees"
    __table_args__ = (
        Index(
            "ix_employees_company_number_active_uq", "company_id", "employee_number",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_employees_company_status", "company_id", "status"),
        ForeignKeyConstraint(
            ["manager_id", "company_id"], ["employees.id", "employees.company_id"],
            name="fk_employees_manager_id_tenant_scoped", ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["user_id", "company_id"], ["users.id", "users.company_id"],
            name="fk_employees_user_id_tenant_scoped", ondelete="SET NULL",
        ),
        UniqueConstraint("id", "company_id", name="uq_employees_id_company"),
        Index(
            "ix_employees_user_id_active_uq", "user_id",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    work_email: Mapped[str | None] = mapped_column(String(255))
    employee_number: Mapped[str] = mapped_column(String(40), nullable=False)
    department: Mapped[str | None] = mapped_column(String(120))
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL")
    )
    hire_date: Mapped[date | None] = mapped_column(Date)
    salary_grade: Mapped[str | None] = mapped_column(String(20))
    employment_type: Mapped[EmploymentType] = mapped_column(
        Enum(EmploymentType, native_enum=False, length=15),
        default=EmploymentType.FULL_TIME, nullable=False,
    )
    status: Mapped[EmployeeStatus] = mapped_column(
        Enum(EmployeeStatus, native_enum=False, length=15),
        default=EmployeeStatus.ACTIVE, nullable=False,
    )

    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])
    manager: Mapped["Employee | None"] = relationship(
        remote_side="Employee.id", foreign_keys=[manager_id]
    )


class LeaveRequest(Base, TenantBusinessMixin):
    __tablename__ = "leave_requests"
    __table_args__ = (
        Index("ix_leave_requests_company_status", "company_id", "approval_status"),
        ForeignKeyConstraint(
            ["employee_id", "company_id"], ["employees.id", "employees.company_id"],
            name="fk_leave_requests_employee_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    leave_type: Mapped[LeaveType] = mapped_column(
        Enum(LeaveType, native_enum=False, length=15), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, native_enum=False, length=10),
        default=ApprovalStatus.PENDING, nullable=False,
    )


class Attendance(Base, TenantBusinessMixin):
    __tablename__ = "attendance"
    __table_args__ = (
        Index(
            "ix_attendance_employee_date_active_uq", "employee_id", "date",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_attendance_company_date", "company_id", "date"),
        ForeignKeyConstraint(
            ["employee_id", "company_id"], ["employees.id", "employees.company_id"],
            name="fk_attendance_employee_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    clock_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hours_worked: Mapped[float | None] = mapped_column(Numeric(5, 2))
