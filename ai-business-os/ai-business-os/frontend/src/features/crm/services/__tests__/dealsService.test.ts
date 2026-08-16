import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveDeal,
  createDeal,
  getDeal,
  listDeals,
  updateDeal,
} from "../dealsService";

const mockRequest = vi.fn();

vi.mock("@/api/client", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

describe("dealsService", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it("lists with camelCase query params and no search", async () => {
    await listDeals({
      page: 2,
      pageSize: 10,
      sortBy: "value",
      sortDesc: true,
      leadId: "lead-1",
      status: "open",
    });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/crm/deals",
        params: {
          page: 2,
          pageSize: 10,
          sortBy: "value",
          sortDesc: true,
          leadId: "lead-1",
          status: "open",
        },
      }),
    );
    const params = (mockRequest.mock.calls[0][0] as { params: Record<string, unknown> })
      .params;
    expect(params).not.toHaveProperty("search");
    expect(params).not.toHaveProperty("customerId");
  });

  it("gets / creates / updates / archives without protected fields", async () => {
    mockRequest.mockResolvedValue({ id: "d1" });
    await getDeal("d1");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/crm/deals/d1" }),
    );

    await createDeal({
      leadId: "lead-1",
      value: 12500,
      currency: "USD",
      status: "open",
    });
    const createCall = mockRequest.mock.calls.find(
      (c) => (c[0] as { method: string }).method === "POST",
    )?.[0] as { data: Record<string, unknown> };
    expect(createCall.data).toMatchObject({
      leadId: "lead-1",
      value: 12500,
      currency: "USD",
      status: "open",
    });
    expect(createCall.data).not.toHaveProperty("companyId");
    expect(createCall.data).not.toHaveProperty("customerId");
    expect(createCall.data).not.toHaveProperty("id");

    await updateDeal("d1", { status: "won", value: 13000 });
    const updateCall = mockRequest.mock.calls.find(
      (c) => (c[0] as { method: string }).method === "PATCH",
    )?.[0] as { data: Record<string, unknown> };
    expect(updateCall.data).toEqual({ status: "won", value: 13000 });
    expect(updateCall.data).not.toHaveProperty("leadId");
    expect(updateCall.data).not.toHaveProperty("customerId");

    mockRequest.mockResolvedValue(null);
    await archiveDeal("d1");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE", url: "/crm/deals/d1" }),
    );
  });
});
