import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn(),
}));

import { request } from "@/api/client";
import { clockIn, clockOut, listAttendance } from "../attendanceService";
import {
  approveLeaveRequest,
  createLeaveRequest,
  listLeaveRequests,
  rejectLeaveRequest,
} from "../leaveRequestsService";

const mockedRequest = vi.mocked(request);

describe("leave + attendance services", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("lists and mutates leave requests", async () => {
    mockedRequest
      .mockResolvedValueOnce({ items: [], meta: {} })
      .mockResolvedValueOnce({ id: "l1" })
      .mockResolvedValueOnce({ id: "l1", approvalStatus: "approved" })
      .mockResolvedValueOnce({ id: "l1", approvalStatus: "rejected" });

    await listLeaveRequests({ page: 1 });
    await createLeaveRequest({
      leaveType: "vacation",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
    });
    await approveLeaveRequest("l1");
    await rejectLeaveRequest("l1");

    expect(mockedRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: "GET", url: "/hr/leave-requests" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: "POST", url: "/hr/leave-requests" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        method: "POST",
        url: "/hr/leave-requests/l1/approve",
      }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        method: "POST",
        url: "/hr/leave-requests/l1/reject",
      }),
    );
  });

  it("lists and clocks attendance", async () => {
    mockedRequest
      .mockResolvedValueOnce({ items: [], meta: {} })
      .mockResolvedValueOnce({ id: "a1" })
      .mockResolvedValueOnce({ id: "a1" });

    await listAttendance({ page: 1 });
    await clockIn();
    await clockOut();

    expect(mockedRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: "GET", url: "/hr/attendance" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: "POST", url: "/hr/attendance/clock-in" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: "POST", url: "/hr/attendance/clock-out" }),
    );
  });
});
