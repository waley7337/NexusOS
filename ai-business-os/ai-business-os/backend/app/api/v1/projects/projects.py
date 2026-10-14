"""Projects API — tenant-scoped CRUD (Part 08.4).

Permissions: projects.read (list/detail), projects.manage (create/update/delete).
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.projects import ActiveUser, DbSession, ProjectRepo
from app.models.enums import ProjectStatus
from app.models.project import Project
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_response(project: Project) -> ProjectResponse:
    return ProjectResponse.model_validate(project)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get("", dependencies=[Depends(require_permission("projects.read"))])
async def list_projects(
    repo: ProjectRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    status: Annotated[ProjectStatus | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> ApiResponse[Paginated[ProjectResponse]]:
    items, total = await repo.list_filtered(
        page=page, page_size=page_size, sort_by=sort_by, sort_desc=sort_desc,
        status=status, search=search,
    )
    return ApiResponse.ok(data=Paginated.build(
        items=[_to_response(p) for p in items], total=total, page=page, page_size=page_size,
    ))


@router.post("", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission("projects.manage"))])
async def create_project(
    payload: ProjectCreate, repo: ProjectRepo, user: ActiveUser,
    db: DbSession, request: Request,
) -> ApiResponse[ProjectResponse]:
    data = payload.model_dump()
    created = await repo.create(Project(**data))
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="project.created", entity="projects", entity_id=created.id,
        new_values={"name": created.name, "status": created.status.value},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(created), message="Project created.")


@router.get("/{project_id}", dependencies=[Depends(require_permission("projects.read"))])
async def get_project(project_id: uuid.UUID, repo: ProjectRepo) -> ApiResponse[ProjectResponse]:
    return ApiResponse.ok(data=_to_response(await repo.get(project_id)))


@router.patch("/{project_id}", dependencies=[Depends(require_permission("projects.manage"))])
async def update_project(
    project_id: uuid.UUID, payload: ProjectUpdate, repo: ProjectRepo,
    user: ActiveUser, db: DbSession, request: Request,
) -> ApiResponse[ProjectResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")
    existing = await repo.get(project_id)
    old_snapshot = {k: getattr(existing, k) for k in values}
    updated = await repo.update(project_id, values)
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="project.updated", entity="projects", entity_id=updated.id,
        old_values={k: str(v) if v is not None else None for k, v in old_snapshot.items()},
        new_values={k: str(getattr(updated, k)) if getattr(updated, k) is not None else None for k in values},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(updated), message="Project updated.")


@router.delete("/{project_id}", dependencies=[Depends(require_permission("projects.manage"))])
async def delete_project(
    project_id: uuid.UUID, repo: ProjectRepo, user: ActiveUser,
    db: DbSession, request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(project_id)
    await repo.soft_delete(project_id)
    ip, ua = _client_meta(request)
    await audit_service.record(
        db, company_id=user.company_id, user_id=user.id,
        action="project.deleted", entity="projects", entity_id=project_id,
        old_values={"name": existing.name}, new_values={"deleted": True},
        ip_address=ip, user_agent=ua,
    )
    return ApiResponse.ok(message="Project deleted.")
