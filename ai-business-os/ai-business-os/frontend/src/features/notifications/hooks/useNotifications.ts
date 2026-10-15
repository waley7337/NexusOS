import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/notificationsService";
import type { Notification, NotificationListParams, UnreadCount } from "../types";

const UNREAD_POLL_MS = 30_000;

type NotificationListCache = {
  items: Notification[];
  meta: unknown;
};

function isNotificationListCache(
  value: unknown,
): value is NotificationListCache {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as NotificationListCache).items)
  );
}

export function useNotifications(params: NotificationListParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.notifications.list, params] as const,
    queryFn: ({ signal }) => service.listNotifications(params, signal),
    enabled,
  });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: ({ signal }) => service.getUnreadCount(signal),
    refetchInterval: UNREAD_POLL_MS,
    enabled,
  });
}

function invalidateNotificationQueries(
  client: ReturnType<typeof useQueryClient>,
) {
  void client.invalidateQueries({ queryKey: queryKeys.notifications.all });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.markNotificationRead,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.all });
      const previousList = client.getQueriesData({
        queryKey: queryKeys.notifications.list,
      });
      const previousCount = client.getQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
      );

      let markedUnread = false;
      client.setQueriesData(
        { queryKey: queryKeys.notifications.list },
        (current: unknown) => {
          if (!isNotificationListCache(current)) return current;
          return {
            ...current,
            items: current.items.map((item) => {
              if (item.id !== id || item.isRead) return item;
              markedUnread = true;
              return { ...item, isRead: true };
            }),
          };
        },
      );
      if (markedUnread && previousCount && previousCount.count > 0) {
        client.setQueryData(queryKeys.notifications.unreadCount, {
          count: previousCount.count - 1,
        });
      }

      return { previousList, previousCount };
    },
    onError: (_error, _id, context) => {
      context?.previousList?.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      if (context?.previousCount !== undefined) {
        client.setQueryData(
          queryKeys.notifications.unreadCount,
          context.previousCount,
        );
      }
    },
    onSettled: () => invalidateNotificationQueries(client),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.markAllNotificationsRead,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.all });
      const previousList = client.getQueriesData({
        queryKey: queryKeys.notifications.list,
      });
      const previousCount = client.getQueryData<UnreadCount>(
        queryKeys.notifications.unreadCount,
      );

      client.setQueriesData(
        { queryKey: queryKeys.notifications.list },
        (current: unknown) => {
          if (!isNotificationListCache(current)) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.isRead ? item : { ...item, isRead: true },
            ),
          };
        },
      );
      client.setQueryData(queryKeys.notifications.unreadCount, { count: 0 });

      return { previousList, previousCount };
    },
    onError: (_error, _vars, context) => {
      context?.previousList?.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      if (context?.previousCount !== undefined) {
        client.setQueryData(
          queryKeys.notifications.unreadCount,
          context.previousCount,
        );
      }
    },
    onSettled: () => invalidateNotificationQueries(client),
  });
}
