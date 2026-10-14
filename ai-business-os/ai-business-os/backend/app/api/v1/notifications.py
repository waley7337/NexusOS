"""In-app notifications API — current-user inbox only.

Auth: active session required. No module permission — every signed-in user
reads and updates only their own notifications (tenant + user scoped).

Endpoints:
  GET  /notifications
  GET  /notifications/unread-count
  POST /notifications/{id}/read
  POST /notifications/read-all
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies.notifications import NotificationRepo
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.notifications import (
    MarkAllReadResponse,
    NotificationResponse,
    UnreadCountResponse,
    notification_to_response,
)
from app.schemas.response import ApiResponse, Paginated

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    repo: NotificationRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    unread_only: Annotated[bool, Query(alias="unreadOnly")] = False,
) -> ApiResponse[Paginated[NotificationResponse]]:
    items, total = await repo.list_for_user(
        page=page,
        page_size=page_size,
        unread_only=unread_only,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[notification_to_response(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/unread-count")
async def get_unread_count(
    repo: NotificationRepo,
) -> ApiResponse[UnreadCountResponse]:
    count = await repo.unread_count()
    return ApiResponse.ok(data=UnreadCountResponse(count=count))


@router.post("/read-all")
async def mark_all_read(
    repo: NotificationRepo,
) -> ApiResponse[MarkAllReadResponse]:
    updated = await repo.mark_all_read()
    return ApiResponse.ok(
        data=MarkAllReadResponse(updated=updated),
        message="All notifications marked as read." if updated else "No unread notifications.",
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    repo: NotificationRepo,
) -> ApiResponse[NotificationResponse]:
    updated = await repo.mark_read(notification_id)
    return ApiResponse.ok(
        data=notification_to_response(updated),
        message="Notification marked as read.",
    )
