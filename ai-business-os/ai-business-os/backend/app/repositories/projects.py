"""Projects and Tasks repositories — tenant-scoped (Part 08.4)."""
from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import func, select

from app.core.exceptions import NotFoundError
from app.models.enums import ProjectStatus, TaskStatus
from app.models.project import Project, Task
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project
    SORT_FIELDS = {
        "created_at": Project.created_at,
        "name": Project.name,
        "due_date": Project.due_date,
        "status": Project.status,
        "priority": Project.priority,
    }

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        status: ProjectStatus | None = None,
        search: str | None = None,
    ) -> tuple[List[Project], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if status is not None:
            stmt = stmt.where(Project.status == status)

        if search:
            term = search.strip()[:100]
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(Project.name.ilike(f"%{pattern}%", escape="\\"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        else:
            stmt = stmt.order_by(Project.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def ensure_project_in_tenant(self, project_id: uuid.UUID) -> Project:
        stmt = self._base_query().where(Project.id == project_id)
        result = await self.db.execute(stmt)
        project = result.scalar_one_or_none()
        if project is None:
            raise NotFoundError("Project not found.")
        return project


class TaskRepository(BaseRepository[Task]):
    model = Task
    SORT_FIELDS = {
        "created_at": Task.created_at,
        "title": Task.title,
        "due_date": Task.due_date,
        "status": Task.status,
        "priority": Task.priority,
    }

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        project_id: uuid.UUID | None = None,
        status: TaskStatus | None = None,
        assignee_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> tuple[List[Task], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if project_id is not None:
            stmt = stmt.where(Task.project_id == project_id)
        if status is not None:
            stmt = stmt.where(Task.status == status)
        if assignee_id is not None:
            stmt = stmt.where(Task.assignee_id == assignee_id)

        if search:
            term = search.strip()[:100]
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(Task.title.ilike(f"%{pattern}%", escape="\\"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        else:
            stmt = stmt.order_by(Task.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total
