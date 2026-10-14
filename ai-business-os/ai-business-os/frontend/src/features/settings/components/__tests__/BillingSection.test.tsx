import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { BILLING_ENV_VAR_NAMES, BillingSection } from "../BillingSection";

const api = vi.hoisted(() => ({
  getBillingStatus: vi.fn(),
  createBillingCheckout: vi.fn(),
  createBillingPortal: vi.fn(),
  cancelBillingSubscription: vi.fn(),
  me: vi.fn(),
}));

vi.mock("../../services/billingService", () => ({
  getBillingStatus: api.getBillingStatus,
  createBillingCheckout: api.createBillingCheckout,
  createBillingPortal: api.createBillingPortal,
  cancelBillingSubscription: api.cancelBillingSubscription,
}));
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<object>("@/features/auth")),
  getMe: api.me,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { toast } from "sonner";

const status = {
  plan: "free" as const,
  status: "no_subscription" as const,
  entitled: true,
  cancelAtPeriodEnd: false,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  trialEndsAt: null,
  stripeCustomerLinked: false,
  billingEnabled: false,
};

function renderBilling(path = "/settings", permissions: string[] = ["settings.view", "settings.manage"]) {
  api.me.mockResolvedValue({ user: { id: "u1" }, permissions });
  useAuthStore.setState({
    accessToken: "token",
    refreshToken: "refresh",
    user: {
      id: "u1",
      email: "a@b.co",
      name: "Ada",
      role: "owner",
      companyId: "c1",
      companyName: "Co",
      companySlug: "co",
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BillingSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BillingSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBillingStatus.mockResolvedValue(status);
  });

  it("hides when settings.view is missing", async () => {
    renderBilling("/settings", []);
    await waitFor(() => expect(api.me).toHaveBeenCalled());
    expect(screen.queryByText("NexusOS subscription")).not.toBeInTheDocument();
    expect(api.getBillingStatus).not.toHaveBeenCalled();
  });

  it("shows loading then honest unavailable env guidance when billing is disabled", async () => {
    let resolve!: (value: typeof status) => void;
    api.getBillingStatus.mockReturnValue(new Promise((done) => { resolve = done; }));
    renderBilling();
    expect(await screen.findByLabelText("Loading billing")).toBeInTheDocument();
    resolve(status);
    expect(await screen.findByText("NexusOS subscription")).toBeInTheDocument();
    expect(screen.getByText(/Billing configured/i).closest("div")).toHaveTextContent(/No/);
    const guidance = screen.getByText(/Required env var names/i);
    for (const name of BILLING_ENV_VAR_NAMES) {
      expect(guidance).toHaveTextContent(name);
    }
    expect(screen.getByRole("button", { name: "Upgrade starter" })).toBeDisabled();
  });

  it("keeps API failures distinct from disabled billing", async () => {
    api.getBillingStatus.mockRejectedValue(new ApiRequestError("Not Found", []));
    renderBilling();
    expect(await screen.findByText("Billing unavailable")).toBeInTheDocument();
    expect(screen.queryByText("NexusOS subscription")).not.toBeInTheDocument();
  });

  it("treats checkout return as non-authoritative and refreshes from the server", async () => {
    renderBilling("/settings?billing=success&session_id=cs_test");
    await screen.findByText("NexusOS subscription");
    await waitFor(() => expect(toast.message).toHaveBeenCalled());
    expect(String(vi.mocked(toast.message).mock.calls[0]?.[0])).toMatch(/not confirmation/i);
    await waitFor(() => expect(api.getBillingStatus).toHaveBeenCalled());
    expect(screen.queryByText(/session_id/i)).not.toBeInTheDocument();
  });

  it("starts server-side checkout only when billing is enabled", async () => {
    const user = userEvent.setup();
    api.getBillingStatus.mockResolvedValue({ ...status, billingEnabled: true });
    api.createBillingCheckout.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.test/session",
      checkoutSessionId: "cs_1",
      plan: "starter",
    });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });

    renderBilling();
    await user.click(await screen.findByRole("button", { name: "Upgrade starter" }));
    await waitFor(() => expect(api.createBillingCheckout).toHaveBeenCalledWith("starter"));
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.test/session");
    vi.unstubAllGlobals();
  });
});