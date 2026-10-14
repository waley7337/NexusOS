/** Notifications module — inbox panel, unread badge, mark-read actions. */
export { NotificationPanel } from "./components/NotificationPanel";
export {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "./hooks/useNotifications";
export type {
  MarkAllReadResult,
  Notification,
  NotificationListParams,
  NotificationType,
  UnreadCount,
} from "./types";
