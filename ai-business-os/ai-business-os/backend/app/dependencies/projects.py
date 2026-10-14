"""Projects + Tasks FastAPI dependency helpers."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.repositories.projects import ProjectRepository, TaskRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_project_repository(db: DbSession, user: ActiveUser) -> ProjectRepository:
    return ProjectRepository(db, company_id=user.company_id, user_id=user.id)


def get_task_repository(db: DbSession, user: ActiveUser) -> TaskRepository:
    return TaskRepository(db, company_id=user.company_id, user_id=user.id)


ProjectRepo = Annotated[ProjectRepository, Depends(get_project_repository)]
TaskRepo = Annotated[TaskRepository, Depends(get_task_repository)]
