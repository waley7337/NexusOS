import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/notificationsService";
import type { Notification, NotificationListParams } from "../types";

const UNREAD_POLL_MS = 30_000;

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
      const previousCount = client.getQueryData<{ count: number }>(
        queryKeys.notifications.unreadCount,
      );

      client.setQueriesData(
        { queryKey: queryKeys.notifications.list },
        (current: { items: Notification[]; meta: unknown } | undefined) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, isRead: true } : item,
            ),
          };
        },
      );
      if (previousCount && previousCount.count > 0) {
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
      const previousCount = client.getQueryData<{ count: number }>(
        queryKeys.notifications.unreadCount,
      );

      client.setQueriesData(
        { queryKey: queryKeys.notifications.list },
        (current: { items: Notification[]; meta: unknown } | undefined) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) => ({ ...item, isRead: true })),
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
