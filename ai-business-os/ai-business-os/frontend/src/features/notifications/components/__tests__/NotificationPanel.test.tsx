import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/notificationsService", () => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

import * as service from "../../services/notificationsService";
import { NotificationPanel } from "../NotificationPanel";

const listNotifications = vi.mocked(service.listNotifications);
const markNotificationRead = vi.mocked(service.markNotificationRead);
const markAllNotificationsRead = vi.mocked(service.markAllNotificationsRead);

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationPanel open />
    </QueryClientProvider>,
  );
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    listNotifications.mockReset();
    markNotificationRead.mockReset();
    markAllNotificationsRead.mockReset();
  });

  it("shows empty state when there are no notifications", async () => {
    listNotifications.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    });
    renderPanel();
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("lists items and marks one as read", async () => {
    const user = userEvent.setup();
    listNotifications.mockResolvedValue({
      items: [
        {
          id: "n1",
          companyId: "c1",
          userId: "u1",
          title: "Invoice overdue",
          message: "INV-1 is overdue",
          type: "warning",
          isRead: false,
          createdAt: "2026-10-01T12:00:00Z",
          updatedAt: "2026-10-01T12:00:00Z",
        },
      ],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    markNotificationRead.mockResolvedValue({
      id: "n1",
      companyId: "c1",
      userId: "u1",
      title: "Invoice overdue",
      message: "INV-1 is overdue",
      type: "warning",
      isRead: true,
      createdAt: "2026-10-01T12:00:00Z",
      updatedAt: "2026-10-01T12:00:00Z",
    });

    renderPanel();
    expect(await screen.findByText("Invoice overdue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mark all as read/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Mark as read: Invoice overdue/i }));
    await waitFor(() => {
      expect(markNotificationRead.mock.calls[0]?.[0]).toBe("n1");
    });
  });

  it("shows error state with retry", async () => {
    listNotifications.mockRejectedValue(new Error("boom"));
    renderPanel();
    expect(await screen.findByText("Notifications unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });
});
