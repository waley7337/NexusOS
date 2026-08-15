import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn(),
}));

import { request } from "@/api/client";
import { getDashboard } from "../dashboardService";

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
