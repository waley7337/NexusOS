import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/api/client";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/auth";
import { BillingCheckoutPage } from "../BillingCheckoutPage";

const api = vi.hoisted(() => ({
  getBillingStatus: vi.fn(),
  getBillingPlans: vi.fn(),
  createBillingCheckout: vi.fn(),
  createBillingPortal: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/features/settings/services/billingService", () => ({
  getBillingStatus: api.getBillingStatus,
  getBillingPlans: api.getBillingPlans,
  createBillingCheckout: api.createBillingCheckout,
  createBillingPortal: api.createBillingPortal,
  billingErrorReason: (error: unknown) => {
    if (!error || typeof error !== "object") return undefined;
    const errors = (error as { errors?: Array<{ reason?: string }> }).errors;
    return errors?.[0]?.reason;
  },
}));

vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<object>("@/features/auth")),
  getMe: api.me,
}));

vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-checkout-provider">{children}</div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  BillingAddressElement: () => <div data-testid="billing-address-element" />,
  useCheckoutElements: () => ({
    type: "success",
    checkout: {
      confirm: vi.fn().mockResolvedValue({ type: "success" }),
      canConfirm: true,
      total: { total: { amount: "$29.00" } },
    },
  }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

const baseStatus = {
  plan: "free" as const,
  status: "no_subscription" as const,
  entitled: true,
  cancelAtPeriodEnd: false,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  trialEndsAt: null,
  stripeCustomerLinked: false,
  billingEnabled: true,
};

const plans = {
  billingEnabled: true,
  publishableKey: "pk_test_x",
  plans: [
    {
      plan: "starter" as const,
      priceId: "price_starter",
      currency: "usd",
      unitAmount: 2900,
      interval: "month",
      intervalCount: 1,
      productName: "NexusOS Starter",
      configured: true,
    },
  ],
};

function renderCheckout(
  path = `${ROUTES.billingCheckout}?plan=starter`,
  permissions: string[] = ["settings.view", "settings.manage"],
) {
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
        <Routes>
          <Route path={ROUTES.billingCheckout} element={<BillingCheckoutPage />} />
          <Route path={ROUTES.settings} element={<div>Settings</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BillingCheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBillingStatus.mockResolvedValue(baseStatus);
    api.getBillingPlans.mockResolvedValue(plans);
  });

  it("shows plan summary from trusted server pricing", async () => {
    renderCheckout();
    expect(await screen.findByText("Subscribe to NexusOS")).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getAllByText("$29.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/monthly/i)).toBeInTheDocument();
  });

  it("keeps checkout disabled messaging when billing is off", async () => {
    api.getBillingStatus.mockResolvedValue({ ...baseStatus, billingEnabled: false });
    api.getBillingPlans.mockResolvedValue({ ...plans, billingEnabled: false });
    renderCheckout();
    expect(await screen.findByText(/STRIPE_BILLING_ENABLED=false/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue to payment/i })).not.toBeInTheDocument();
  });

  it("routes past_due into portal recovery instead of opening Elements", async () => {
    api.getBillingStatus.mockResolvedValue({
      ...baseStatus,
      plan: "starter",
      status: "past_due",
      entitled: false,
      stripeCustomerLinked: true,
    });
    renderCheckout();
    expect(await screen.findByText("Update payment method")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open billing portal/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continue to payment/i })).not.toBeInTheDocument();
  });

  it("boots Stripe Elements after continue when API returns client secret", async () => {
    const user = userEvent.setup();
    api.createBillingCheckout.mockResolvedValue({
      checkoutUrl: null,
      checkoutSessionId: "cs_test",
      clientSecret: "cs_test_secret",
      publishableKey: "pk_test_x",
      plan: "starter",
      mode: "checkout",
      uiMode: "elements",
    });
    renderCheckout();
    await user.click(await screen.findByRole("button", { name: /Continue to payment/i }));
    await waitFor(() => expect(api.createBillingCheckout).toHaveBeenCalled());
    expect(await screen.findByTestId("stripe-checkout-provider")).toBeInTheDocument();
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subscribe to Starter/i })).toBeInTheDocument();
  });

  it("surfaces subscription_past_due from checkout API as portal recovery", async () => {
    const user = userEvent.setup();
    api.createBillingCheckout.mockRejectedValue(
      new ApiRequestError("Subscription payment failed.", [
        { code: "conflict", reason: "subscription_past_due" },
      ], 409),
    );
    renderCheckout();
    await user.click(await screen.findByRole("button", { name: /Continue to payment/i }));
    expect(await screen.findByText("Update payment method")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open billing portal/i })).toBeInTheDocument();
  });
});
