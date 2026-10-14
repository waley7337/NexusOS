"""Tasks API — tenant-scoped CRUD (Part 08.4).

Tasks are always scoped within a project. The project must belong to the
same tenant as the caller.

Permissions: tasks.read (list/detail), tasks.create/update/delete.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.projects import ActiveUser, DbSession, ProjectRepo, TaskRepo
from app.models.enums import TaskStatus
from app.models.project import Task
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.projects import TaskCreate, TaskResponse, TaskUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _to_response(task: Task) -> TaskResponse:
    return TaskResponse.model_validate(task)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get("", dependencies=[Depends(require_permission("tasks.read"))])
async def list_tasks(
    repo: TaskRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    project_id: Annotated[uuid.UUID | None, Query(alias="projectId")] = None,
    status: Annotated[TaskStatus | None, Query()] = None,
    assignee_id: Annotated[uuid.UUID | None, Query(alias="assigneeId")] = None,
    search: Annotated[str | None, Query()] = None,
) -> ApiResponse[Paginated[TaskResponse]]:
    items, total = await repo.list_filtered(
        page=page, page_size=page_size, sort_by=sort_by, sort_desc=sort_desc,
        project_id=project_id, status=status, assignee_id=assignee_id, search=search,
    )
    return ApiResponse.ok(data=Paginated.build(
        items=[_to_response(t) for t in items], total=total, page=page, page_size=page_size,
    ))


@router.post("", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("tasks.create"))])
async def create_task(
    payload: TaskCreate, task_repo: TaskRepo, project_repo: ProjectRepo,
    user: ActiveUser, db: DbSession, request: Request,
) -> ApiResponse[TaskResponse]:
    # Ensure the referenced project exists and belongs to the caller's tenant.
    await project_repo.ensure_project_in_tenant(payload.project_id)
    data = payload.model_dump()
    task = Task(**data)
    task.reporter_id = user.id
    created = await task_repo.create(task)
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="task.created", entity="tasks", entity_id=created.id,
        new_values={
            "title": created.title,
            "project_id": str(created.project_id),
            "status": created.status.value,
        },
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(created), message="Task created.")


@router.get("/{task_id}", dependencies=[Depends(require_permission("tasks.read"))])
async def get_task(task_id: uuid.UUID, repo: TaskRepo) -> ApiResponse[TaskResponse]:
    return ApiResponse.ok(data=_to_response(await repo.get(task_id)))


@router.patch("/{task_id}", dependencies=[Depends(require_permission("tasks.update"))])
async def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, repo: TaskRepo,
    user: ActiveUser, db: DbSession, request: Request,
) -> ApiResponse[TaskResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")
    existing = await repo.get(task_id)
    old_snapshot = {k: getattr(existing, k) for k in values}
    updated = await repo.update(task_id, values)
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="task.updated", entity="tasks", entity_id=updated.id,
        old_values={k: str(v) if v is not None else None for k, v in old_snapshot.items()},
        new_values={k: str(getattr(updated, k)) if getattr(updated, k) is not None else None for k in values},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(updated), message="Task updated.")


@router.delete("/{task_id}", dependencies=[Depends(require_permission("tasks.delete"))])
async def delete_task(
    task_id: uuid.UUID, repo: TaskRepo, user: ActiveUser,
    db: DbSession, request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(task_id)
    await repo.soft_delete(task_id)
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="task.deleted", entity="tasks", entity_id=task_id,
        old_values={"title": existing.title}, new_values={"deleted": True},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(message="Task deleted.")
