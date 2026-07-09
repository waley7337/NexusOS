"""Projects & tasks — the Linear-style work tracker."""
import uuid
from datetime import date

from sqlalchemy import (
    Date, Enum, ForeignKey, Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin
from app.models.enums import Priority, ProjectStatus, TaskStatus


class Project(Base, TenantBusinessMixin):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_company_status", "company_id", "status"),
        Index("ix_projects_company_owner", "company_id", "owner_id"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, native_enum=False, length=15),
        default=ProjectStatus.PLANNED, nullable=False,
    )
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, native_enum=False, length=10),
        default=Priority.MEDIUM, nullable=False,
    )
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    budget: Mapped[float | None] = mapped_column(Numeric(14, 2))
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0–100

    tasks: Mapped[list["Task"]] = relationship(back_populates="project")


class Task(Base, TenantBusinessMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_company_status", "company_id", "status"),
        Index("ix_tasks_company_assignee", "company_id", "assignee_id"),
        Index("ix_tasks_company_due", "company_id", "due_date"),
        Index("ix_tasks_project_status", "project_id", "status"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, native_enum=False, length=15),
        default=TaskStatus.TODO, nullable=False,
    )
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority, native_enum=False, length=10),
        default=Priority.MEDIUM, nullable=False,
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    estimated_hours: Mapped[float | None] = mapped_column(Numeric(6, 2))
    actual_hours: Mapped[float | None] = mapped_column(Numeric(6, 2))

    project: Mapped["Project"] = relationship(back_populates="tasks")
    comments: Mapped[list["TaskComment"]] = relationship(back_populates="task")


class TaskComment(Base, TenantBusinessMixin):
    __tablename__ = "task_comments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped["Task"] = relationship(back_populates="comments")


class TaskAttachment(Base, TenantBusinessMixin):
    __tablename__ = "task_attachments"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
