"""Notification API schemas — camelCase on the wire."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import Field

from app.models.enums import NotificationType
from app.schemas.base import CamelModel

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    user_id: uuid.UUID = Field(alias="userId")
    title: str
    message: str
    type: NotificationType
    is_read: bool = Field(alias="isRead")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class UnreadCountResponse(CamelModel):
    count: int


class MarkAllReadResponse(CamelModel):
    updated: int


def notification_to_response(row: Notification) -> NotificationResponse:
    return NotificationResponse.model_validate(row)
