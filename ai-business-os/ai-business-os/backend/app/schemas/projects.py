"""Projects and Tasks request/response schemas (Part 08.4).

Wire names are camelCase; Python attributes are snake_case, matching the
CRM / HR / Finance / Inventory module convention.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import Field

from app.models.enums import Priority, ProjectStatus, TaskStatus
from app.schemas.base import CamelModel


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: ProjectStatus = ProjectStatus.PLANNED
    priority: Priority = Priority.MEDIUM
    start_date: date | None = Field(default=None, alias="startDate")
    due_date: date | None = Field(default=None, alias="dueDate")
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    budget: float | None = None
    progress: int = Field(default=0, ge=0, le=100)


class ProjectUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: ProjectStatus | None = None
    priority: Priority | None = None
    start_date: date | None = Field(default=None, alias="startDate")
    due_date: date | None = Field(default=None, alias="dueDate")
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    budget: float | None = None
    progress: int | None = Field(default=None, ge=0, le=100)


class ProjectResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    name: str
    description: str | None = None
    status: ProjectStatus
    priority: Priority
    start_date: date | None = Field(default=None, alias="startDate")
    due_date: date | None = Field(default=None, alias="dueDate")
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    budget: float | None = None
    progress: int
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

class TaskCreate(CamelModel):
    project_id: uuid.UUID = Field(alias="projectId")
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: Priority = Priority.MEDIUM
    assignee_id: uuid.UUID | None = Field(default=None, alias="assigneeId")
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_hours: float | None = Field(default=None, alias="estimatedHours", ge=0)


class TaskUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    assignee_id: uuid.UUID | None = Field(default=None, alias="assigneeId")
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_hours: float | None = Field(default=None, alias="estimatedHours", ge=0)
    actual_hours: float | None = Field(default=None, alias="actualHours", ge=0)
    progress: int | None = Field(default=None, ge=0, le=100)


class TaskResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    project_id: uuid.UUID = Field(alias="projectId")
    title: str
    description: str | None = None
    status: TaskStatus
    priority: Priority
    assignee_id: uuid.UUID | None = Field(default=None, alias="assigneeId")
    reporter_id: uuid.UUID | None = Field(default=None, alias="reporterId")
    due_date: date | None = Field(default=None, alias="dueDate")
    estimated_hours: float | None = Field(default=None, alias="estimatedHours")
    actual_hours: float | None = Field(default=None, alias="actualHours")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")
