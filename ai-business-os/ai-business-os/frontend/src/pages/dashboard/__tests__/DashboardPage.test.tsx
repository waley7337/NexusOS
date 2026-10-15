import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../DashboardPage";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import type { DashboardSnapshot, DashboardMetrics } from "@/features/dashboard/types";

const mockGetDashboard = vi.fn();
const mockGetDashboardMetrics = vi.fn();

vi.mock("@/features/dashboard/services/dashboardService", () => ({
  getDashboard: () => mockGetDashboard(),
  getDashboardMetrics: () => mockGetDashboardMetrics(),
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const snapshot: DashboardSnapshot = {
  apiStatus: "ok",
  environment: "development",
  database: "ok",
};

const emptyMetrics: DashboardMetrics = {
  asOf: "2026-10-14",
  monthStart: "2026-10-01",
  finance: {
    openInvoiceCount: 0,
    overdueInvoiceCount: 0,
    outstandingAmount: "0",
    collectedThisMonth: "0",
    collectedPaymentCount: 0,
  },
  crm: { customerCount: 0, openLeadCount: 0, openDealCount: 0 },
  projects: {
    activeProjectCount: 0,
    totalProjectCount: 0,
    openTaskCount: 0,
    overdueTaskCount: 0,
  },
  hr: { employeeCount: 0 },
  inventory: { lowStockCount: 0 },
};

describe("DashboardPage", () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockGetDashboardMetrics.mockReset();
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "u1",
        email: "phaseb-verify@example.com",
        name: "Waley Elnagdi",
        role: "owner",
        companyId: "c1",
        companyName: "Phase B Verify",
        companySlug: "phase-b-verify",
      },
    });
    useUiStore.setState({ isCaptureOpen: false, isCommandPaletteOpen: false });
  });

  it("renders real workspace identity and omits mock analytics", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    mockGetDashboardMetrics.mockResolvedValue(emptyMetrics);
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: /Waley/ })).toBeInTheDocument();
    expect(screen.getAllByText("Phase B Verify").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/owner/i).length).toBeGreaterThan(0);
    expect(await screen.findByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();

    // Metric chip labels are visible when metrics resolve
    expect(await screen.findByText("Open invoices")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Active projects")).toBeInTheDocument();
    expect(screen.getByText("Active employees")).toBeInTheDocument();

    // Invented numbers must not appear
    expect(screen.queryByText("$128,430")).not.toBeInTheDocument();
    expect(screen.queryByText("Sarah Kim")).not.toBeInTheDocument();
    expect(screen.queryByText(/Weekly pipeline review/)).not.toBeInTheDocument();
    expect(screen.queryByText(/close the Q3 pipeline/)).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue vs expenses")).not.toBeInTheDocument();
  });

  it("lists modules with operational badges for integrated modules and honest empties for the rest", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    mockGetDashboardMetrics.mockResolvedValue(emptyMetrics);
    renderDashboard();

    expect(await screen.findByRole("link", { name: /CRM/ })).toHaveAttribute("href", "/crm");
    // Multiple modules are now operational (CRM, HR, Finance, Inventory, Projects, Tasks)
    expect(screen.getAllByText("Operational").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Not operational").length).toBeGreaterThan(0);
    expect(screen.queryByText("312")).not.toBeInTheDocument();
  });

  it("shows metrics unavailable state when metrics query errors", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    mockGetDashboardMetrics.mockRejectedValue(new Error("metrics unavailable"));
    renderDashboard();

    expect(await screen.findByText("Metrics unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps identity visible when health probes fail and offers retry", async () => {
    mockGetDashboard.mockRejectedValue(new Error("offline"));
    mockGetDashboardMetrics.mockRejectedValue(new Error("offline"));
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: /Waley/ })).toBeInTheDocument();
    expect(await screen.findByText("Unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens Capture from the header action", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    mockGetDashboardMetrics.mockResolvedValue(emptyMetrics);
    const user = userEvent.setup();
    renderDashboard();

    const captures = await screen.findAllByRole("button", { name: "Capture" });
    await user.click(captures[0]);
    expect(useUiStore.getState().isCaptureOpen).toBe(true);
  });
});

