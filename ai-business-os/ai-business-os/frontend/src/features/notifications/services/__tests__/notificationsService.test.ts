import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn(),
}));

import { request } from "@/api/client";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notificationsService";

const mockedRequest = vi.mocked(request);

describe("notificationsService", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("lists notifications with params", async () => {
    mockedRequest.mockResolvedValueOnce({ items: [], meta: {} });
    await listNotifications({ page: 1, unreadOnly: true });
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/notifications",
        params: { page: 1, unreadOnly: true },
      }),
    );
  });

  it("fetches unread count and mark-read actions", async () => {
    mockedRequest
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ id: "n1", isRead: true })
      .mockResolvedValueOnce({ updated: 2 });

    await getUnreadCount();
    await markNotificationRead("n1");
    await markAllNotificationsRead();

    expect(mockedRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: "GET", url: "/notifications/unread-count" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: "POST", url: "/notifications/n1/read" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: "POST", url: "/notifications/read-all" }),
    );
  });
});
