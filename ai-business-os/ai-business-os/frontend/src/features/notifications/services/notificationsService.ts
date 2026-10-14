import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  MarkAllReadResult,
  Notification,
  NotificationListParams,
  UnreadCount,
} from "../types";

const BASE = "/notifications";

export function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Notification>> {
  return request({ method: "GET", url: BASE, params, signal });
}

export function getUnreadCount(signal?: AbortSignal): Promise<UnreadCount> {
  return request({ method: "GET", url: `${BASE}/unread-count`, signal });
}

export function markNotificationRead(id: string): Promise<Notification> {
  return request({ method: "POST", url: `${BASE}/${id}/read` });
}

export function markAllNotificationsRead(): Promise<MarkAllReadResult> {
  return request({ method: "POST", url: `${BASE}/read-all` });
}
