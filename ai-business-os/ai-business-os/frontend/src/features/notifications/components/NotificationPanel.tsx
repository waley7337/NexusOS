import { Bell } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Row, RowGroup } from "@/components/ui/structure";
import { cn } from "@/lib/utils";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/useNotifications";
import type { Notification, NotificationType } from "../types";

const message = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : "Could not load notifications.";

function typeLabel(type: NotificationType): string {
  switch (type) {
    case "action_required":
      return "Action";
    case "success":
      return "Success";
    case "warning":
      return "Warning";
    default:
      return "Info";
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationItem({
  item,
  onMarkRead,
  pending,
}: {
  item: Notification;
  onMarkRead: (id: string) => void;
  pending: boolean;
}) {
  return (
    <Row
      as="button"
      type="button"
      interactive
      disabled={pending || item.isRead}
      onClick={() => {
        if (!item.isRead) onMarkRead(item.id);
      }}
      marker={
        <span
          className={cn(
            "mt-1 h-2 w-2 rounded-full",
            item.isRead ? "bg-transparent" : "bg-info",
          )}
          aria-hidden="true"
        />
      }
      register={<span className="text-2xs">{formatWhen(item.createdAt)}</span>}
      aria-label={
        item.isRead
          ? item.title
          : `Mark as read: ${item.title}`
      }
    >
      <p className={cn("text-sm", !item.isRead && "font-medium")}>{item.title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
        {item.message}
      </p>
      <p className="text-machine mt-1 text-2xs uppercase tracking-wide text-muted-foreground">
        {typeLabel(item.type)}
      </p>
    </Row>
  );
}

export function NotificationPanel({ open }: { open: boolean }) {
  const query = useNotifications({ page: 1, pageSize: 50 }, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = query.data?.items ?? [];
  const hasUnread = items.some((item) => !item.isRead);

  if (query.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading notifications">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Notifications unavailable"
        description={message(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="You'll see mentions, overdue items, and updates from your team here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {hasUnread ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        </div>
      ) : null}
      <RowGroup>
        {items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            pending={markRead.isPending}
            onMarkRead={(id) => markRead.mutate(id)}
          />
        ))}
      </RowGroup>
    </div>
  );
}
