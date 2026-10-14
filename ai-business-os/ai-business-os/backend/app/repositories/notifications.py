"""Notification repository — tenant + recipient scoped inbox queries."""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import Select, func, select, update

from app.core.exceptions import NotFoundError, TenantIsolationError, ValidationError
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    model = Notification
    SORT_FIELDS = {
        "created_at": Notification.created_at,
    }

    def _require_recipient(self) -> uuid.UUID:
        self._require_tenant_context()
        if self.user_id is None:
            raise TenantIsolationError(details={"model": self.model.__name__, "reason": "user_id"})
        return self.user_id

    def _inbox_query(self) -> Select:
        user_id = self._require_recipient()
        return self._base_query().where(Notification.user_id == user_id)

    async def list_for_user(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        unread_only: bool = False,
    ) -> tuple[List[Notification], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._inbox_query()
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = (
            stmt.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self.db.execute(stmt)).scalars().all())
        return rows, total

    async def unread_count(self) -> int:
        stmt = select(func.count()).select_from(
            self._inbox_query().where(Notification.is_read.is_(False)).subquery()
        )
        return (await self.db.execute(stmt)).scalar_one()

    async def get_for_user(self, notification_id: uuid.UUID) -> Notification:
        stmt = self._inbox_query().where(Notification.id == notification_id)
        entity = (await self.db.execute(stmt)).scalar_one_or_none()
        if entity is None:
            raise NotFoundError("Notification not found")
        return entity

    async def mark_read(self, notification_id: uuid.UUID) -> Notification:
        entity = await self.get_for_user(notification_id)
        if not entity.is_read:
            entity.is_read = True
            await self.db.flush()
            await self.db.refresh(entity)
        return entity

    async def mark_all_read(self) -> int:
        user_id = self._require_recipient()
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.company_id == self.company_id,
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )
        await self.db.flush()
        return int(result.rowcount or 0)

    async def create_for_user(
        self,
        *,
        recipient_user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
    ) -> Notification:
        """Create a notification for a tenant user (system / workflow use)."""
        self._require_tenant_context()
        title = (title or "").strip()
        message = (message or "").strip()
        if not title:
            raise ValidationError("Notification title is required.")
        if not message:
            raise ValidationError("Notification message is required.")
        if len(title) > 200:
            raise ValidationError("Notification title must be at most 200 characters.")

        entity = Notification(
            user_id=recipient_user_id,
            title=title,
            message=message,
            type=notification_type,
            is_read=False,
        )
        return await self.create(entity)
