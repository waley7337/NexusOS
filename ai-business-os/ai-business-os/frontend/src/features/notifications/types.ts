export type NotificationType = "info" | "success" | "warning" | "action_required";

export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export interface UnreadCount {
  count: number;
}

export interface MarkAllReadResult {
  updated: number;
}
