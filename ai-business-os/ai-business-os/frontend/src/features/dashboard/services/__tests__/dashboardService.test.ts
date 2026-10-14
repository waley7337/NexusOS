import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn(),
}));

import { request } from "@/api/client";
import { getDashboard, getDashboardMetrics } from "../dashboardService";

const mockedRequest = vi.mocked(request);

describe("getDashboard", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("reads existing /health and /ready probes and does not invent KPIs", async () => {
    mockedRequest
      .mockResolvedValueOnce({ status: "ok", environment: "development" })
      .mockResolvedValueOnce({ database: "ok" });

    await expect(getDashboard()).resolves.toEqual({
      apiStatus: "ok",
      environment: "development",
      database: "ok",
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/health" }),
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/ready" }),
    );
    expect(mockedRequest).toHaveBeenCalledTimes(2);
  });

  it("marks the database unavailable when /ready fails", async () => {
    mockedRequest
      .mockResolvedValueOnce({ status: "ok", environment: "test" })
      .mockRejectedValueOnce(new Error("db down"));

    await expect(getDashboard()).resolves.toEqual({
      apiStatus: "ok",
      environment: "test",
      database: "unavailable",
    });
  });
});

describe("getDashboardMetrics", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("calls GET /dashboard/metrics and returns the payload", async () => {
    const mockMetrics = {
      asOf: "2026-10-14",
      monthStart: "2026-10-01",
      finance: {
        openInvoiceCount: 3,
        overdueInvoiceCount: 1,
        outstandingAmount: "1500.00",
        collectedThisMonth: "3200.00",
        collectedPaymentCount: 4,
      },
      crm: { customerCount: 12, openLeadCount: 5, openDealCount: 2 },
      projects: {
        activeProjectCount: 3,
        totalProjectCount: 5,
        openTaskCount: 8,
        overdueTaskCount: 2,
      },
      hr: { employeeCount: 7 },
      inventory: { lowStockCount: 1 },
    };
    mockedRequest.mockResolvedValueOnce(mockMetrics);

    const result = await getDashboardMetrics();
    expect(result).toEqual(mockMetrics);
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/dashboard/metrics" }),
    );
    expect(mockedRequest).toHaveBeenCalledTimes(1);
  });

  it("propagates errors so callers can handle unavailability", async () => {
    mockedRequest.mockRejectedValueOnce(new Error("401 Unauthorized"));
    await expect(getDashboardMetrics()).rejects.toThrow("401 Unauthorized");
  });
});

