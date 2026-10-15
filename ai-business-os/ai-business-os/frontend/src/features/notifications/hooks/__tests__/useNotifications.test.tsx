import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/constants/queryKeys";
import type { Notification } from "../../types";

vi.mock("../../services/notificationsService", () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import * as service from "../../services/notificationsService";
import { useMarkNotificationRead } from "../useNotifications";

const markNotificationRead = vi.mocked(service.markNotificationRead);

const unreadItem: Notification = {
  id: "n1",
  companyId: "c1",
  userId: "u1",
  title: "Invoice overdue",
  message: "INV-1 is overdue",
  type: "warning",
  isRead: false,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
};

describe("useMarkNotificationRead optimistic cache", () => {
  let client: QueryClient;

  beforeEach(() => {
    markNotificationRead.mockReset();
    markNotificationRead.mockResolvedValue({ ...unreadItem, isRead: true });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData([...queryKeys.notifications.list, { page: 1, pageSize: 50 }], {
      items: [unreadItem],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    client.setQueryData(queryKeys.notifications.unreadCount, { count: 3 });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("marks list item read without corrupting unreadCount cache shape", async () => {
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });

    await act(async () => {
      result.current.mutate("n1");
    });

    await waitFor(() => {
      expect(markNotificationRead.mock.calls[0]?.[0]).toBe("n1");
    });

    const list = client.getQueryData<{ items: Notification[] }>([
      ...queryKeys.notifications.list,
      { page: 1, pageSize: 50 },
    ]);
    const count = client.getQueryData<{ count: number }>(
      queryKeys.notifications.unreadCount,
    );

    expect(list?.items[0]?.isRead).toBe(true);
    expect(count).toEqual({ count: 2 });
    expect(count).not.toHaveProperty("items");
  });
});
