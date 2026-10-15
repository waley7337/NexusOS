import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsPage } from "../ReportsPage";
import { ApiRequestError } from "@/api/client";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return { ...actual, request };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders API-backed summary metrics", async () => {
    request.mockResolvedValue({
      period: { fromDate: "2026-09-14", toDate: "2026-10-14" },
      finance: {
        invoicesByStatus: { sent: { count: 2, totalAmount: "100.00" } },
        paymentsCollected: { count: 1, netPaid: "50.00" },
      },
      crm: { customerCount: 3, openLeadCount: 1, openDealCount: 0 },
      inventory: { lowStockCount: 0 },
    });
    renderPage();
    expect(await screen.findByText("Payments Collected")).toBeInTheDocument();
    expect(screen.getByText("1 payments")).toBeInTheDocument();
    expect(screen.getByText(/Invoices — sent/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("keeps API failures distinct from empty metrics and shows readable network errors", async () => {
    request.mockRejectedValue(
      new ApiRequestError("Network error — the API is unreachable or blocked by CORS. Check VITE_API_BASE_URL and backend CORS_ORIGINS.", [
        { code: "network_error" },
      ]),
    );
    renderPage();
    expect(await screen.findByText("Failed to load report")).toBeInTheDocument();
    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    expect(screen.queryByText("Payments Collected")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Retry$/i })).toBeInTheDocument();
  });

  it("passes date params and abort signal to the reports API", async () => {
    request.mockResolvedValue({
      period: { fromDate: "2026-09-14", toDate: "2026-10-14" },
      finance: { invoicesByStatus: {}, paymentsCollected: { count: 0, netPaid: "0" } },
      crm: { customerCount: 0, openLeadCount: 0, openDealCount: 0 },
      inventory: { lowStockCount: 0 },
    });
    renderPage();
    await screen.findByText("Payments Collected");
    await waitFor(() => expect(request).toHaveBeenCalled());
    const config = request.mock.calls[0][0];
    expect(config.url).toBe("/reports/summary");
    expect(config.params).toEqual(
      expect.objectContaining({ fromDate: expect.any(String), toDate: expect.any(String) }),
    );
    expect(config.signal).toBeDefined();
  });
});
