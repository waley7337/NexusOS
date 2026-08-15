import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../DashboardPage";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import type { DashboardSnapshot } from "@/features/dashboard/types";

const mockGetDashboard = vi.fn();

vi.mock("@/features/dashboard/services/dashboardService", () => ({
  getDashboard: () => mockGetDashboard(),
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

describe("DashboardPage", () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
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
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: /Waley/ })).toBeInTheDocument();
    expect(screen.getAllByText("Phase B Verify").length).toBeGreaterThan(0);
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
    expect(await screen.findByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("No operational metrics yet")).toBeInTheDocument();

    expect(screen.queryByText("$128,430")).not.toBeInTheDocument();
    expect(screen.queryByText("Sarah Kim")).not.toBeInTheDocument();
    expect(screen.queryByText(/Weekly pipeline review/)).not.toBeInTheDocument();
    expect(screen.queryByText(/close the Q3 pipeline/)).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue vs expenses")).not.toBeInTheDocument();
  });

  it("lists placeholder modules as links without inventing counts", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    renderDashboard();

    expect(await screen.findByRole("link", { name: /CRM/ })).toHaveAttribute("href", "/crm");
    expect(screen.getAllByText("Not operational").length).toBeGreaterThan(0);
    expect(screen.queryByText("312")).not.toBeInTheDocument();
  });

  it("keeps identity visible when health probes fail and offers retry", async () => {
    mockGetDashboard.mockRejectedValue(new Error("offline"));
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: /Waley/ })).toBeInTheDocument();
    expect(await screen.findByText("Unreachable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens Capture from the header action", async () => {
    mockGetDashboard.mockResolvedValue(snapshot);
    const user = userEvent.setup();
    renderDashboard();

    const captures = await screen.findAllByRole("button", { name: "Capture" });
    await user.click(captures[0]);
    expect(useUiStore.getState().isCaptureOpen).toBe(true);
  });
});
