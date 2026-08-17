import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/constants/queryKeys";
import type { Lead } from "../../types";
import { useArchiveLead, useCreateLead, useUpdateLead } from "../useLeads";

const mockCreateLead = vi.fn();
const mockUpdateLead = vi.fn();
const mockArchiveLead = vi.fn();

vi.mock("../../services/leadsService", () => ({
  createLead: (...args: unknown[]) => mockCreateLead(...args),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
  archiveLead: (...args: unknown[]) => mockArchiveLead(...args),
  listLeads: vi.fn(),
  getLead: vi.fn(),
}));

function leadFixture(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    companyId: "co-1",
    customerId: "cust-1",
    pipelineStage: "new",
    estimatedValue: "1000",
    probability: null,
    expectedCloseDate: null,
    assignedTo: null,
    notes: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  };
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useLeads mutation cache invalidation", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockCreateLead.mockReset();
    mockUpdateLead.mockReset();
    mockArchiveLead.mockReset();
  });

  it("invalidates lead options and bound lead ids after create", async () => {
    mockCreateLead.mockResolvedValue(leadFixture());

    const { result } = renderHook(() => useCreateLead(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({ customerId: "cust-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.options() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.deals.boundLeadIds() });
  });

  it("invalidates lead options after update", async () => {
    mockUpdateLead.mockResolvedValue(leadFixture({ pipelineStage: "qualified" }));

    const { result } = renderHook(() => useUpdateLead(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate({ id: "lead-1", payload: { pipelineStage: "qualified" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.options() });
  });

  it("invalidates lead options and bound lead ids after archive", async () => {
    mockArchiveLead.mockResolvedValue(undefined);

    const { result } = renderHook(() => useArchiveLead(), {
      wrapper: wrapperFor(queryClient),
    });

    result.current.mutate("lead-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.leads.options() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.crm.deals.boundLeadIds() });
  });
});
