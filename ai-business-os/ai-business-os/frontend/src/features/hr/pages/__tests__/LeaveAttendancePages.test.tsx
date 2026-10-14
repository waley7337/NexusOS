import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/useLeaveRequests", () => ({
  useLeaveRequests: vi.fn(),
  useCreateLeaveRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveLeaveRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectLeaveRequest: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../hooks/useAttendance", () => ({
  useAttendance: vi.fn(),
  useClockIn: () => ({ mutate: vi.fn(), isPending: false }),
  useClockOut: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => true,
  useAuthMe: () => ({
    data: {
      permissions: [
        "employees.read",
        "leave_requests.read",
        "leave_requests.create",
        "leave_requests.approve",
        "attendance.read",
        "attendance.clock",
      ],
    },
  }),
}));

import { useAttendance } from "../../hooks/useAttendance";
import { useLeaveRequests } from "../../hooks/useLeaveRequests";
import { AttendancePage } from "../AttendancePage";
import { LeaveRequestsPage } from "../LeaveRequestsPage";

const useLeaveRequestsMock = vi.mocked(useLeaveRequests);
const useAttendanceMock = vi.mocked(useAttendance);

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Leave + Attendance pages", () => {
  beforeEach(() => {
    useLeaveRequestsMock.mockReset();
    useAttendanceMock.mockReset();
  });

  it("renders leave empty state", () => {
    useLeaveRequestsMock.mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    wrap(<LeaveRequestsPage />);
    expect(screen.getByText("No leave requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request leave/i })).toBeInTheDocument();
  });

  it("renders attendance empty state with clock actions", () => {
    useAttendanceMock.mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    wrap(<AttendancePage />);
    expect(screen.getByText("No attendance records")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clock in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clock out/i })).toBeInTheDocument();
  });
});
