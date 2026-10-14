"""Notification FastAPI dependency helpers."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.repositories.notifications import NotificationRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_notification_repository(
    db: DbSession,
    user: ActiveUser,
) -> NotificationRepository:
    return NotificationRepository(db, company_id=user.company_id, user_id=user.id)


NotificationRepo = Annotated[NotificationRepository, Depends(get_notification_repository)]
