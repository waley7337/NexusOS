import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveLead,
  createLead,
  getLead,
  listLeads,
  updateLead,
} from "../leadsService";

const mockRequest = vi.fn();

vi.mock("@/api/client", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

describe("leadsService", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it("lists with camelCase query params", async () => {
    await listLeads({
      page: 2,
      pageSize: 10,
      sortBy: "estimated_value",
      sortDesc: true,
      search: "pipeline",
      customerId: "cust-1",
      pipelineStage: "qualified",
      assignedTo: "user-1",
    });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/crm/leads",
        params: {
          page: 2,
          pageSize: 10,
          sortBy: "estimated_value",
          sortDesc: true,
          search: "pipeline",
          customerId: "cust-1",
          pipelineStage: "qualified",
          assignedTo: "user-1",
        },
      }),
    );
  });

  it("gets / creates / updates / archives without protected fields", async () => {
    mockRequest.mockResolvedValue({ id: "l1" });
    await getLead("l1");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/crm/leads/l1" }),
    );

    await createLead({
      customerId: "cust-1",
      pipelineStage: "new",
      estimatedValue: 1000,
    });
    const createCall = mockRequest.mock.calls.find(
      (c) => (c[0] as { method: string }).method === "POST",
    )?.[0] as { data: Record<string, unknown> };
    expect(createCall.data).not.toHaveProperty("companyId");
    expect(createCall.data).not.toHaveProperty("id");

    await updateLead("l1", { pipelineStage: "won" });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: "/crm/leads/l1",
        data: { pipelineStage: "won" },
      }),
    );

    mockRequest.mockResolvedValue(null);
    await archiveLead("l1");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE", url: "/crm/leads/l1" }),
    );
  });
});
