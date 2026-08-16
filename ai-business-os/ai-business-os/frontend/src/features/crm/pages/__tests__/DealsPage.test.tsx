import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "../DealsPage";
import { useAuthStore } from "@/stores/auth";
import { ApiRequestError } from "@/api/client";
import type { Customer, Deal, Lead } from "../../types";
import type { Paginated } from "@/types/api";

const CUST_1 = "11111111-1111-4111-8111-111111111111";
const LEAD_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DEAL_1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_1 = "u1";

const mockListDeals = vi.fn();
const mockGetDeal = vi.fn();
const mockCreateDeal = vi.fn();
const mockUpdateDeal = vi.fn();
const mockArchiveDeal = vi.fn();
const mockListLeads = vi.fn();
const mockGetLead = vi.fn();
const mockUpdateLead = vi.fn();
const mockListCustomers = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/crm/services/dealsService", () => ({
  listDeals: (...args: unknown[]) => mockListDeals(...args),
  getDeal: (...args: unknown[]) => mockGetDeal(...args),
  createDeal: (...args: unknown[]) => mockCreateDeal(...args),
  updateDeal: (...args: unknown[]) => mockUpdateDeal(...args),
  archiveDeal: (...args: unknown[]) => mockArchiveDeal(...args),
}));

vi.mock("@/features/crm/services/leadsService", () => ({
  listLeads: (...args: unknown[]) => mockListLeads(...args),
  getLead: (...args: unknown[]) => mockGetLead(...args),
  createLead: vi.fn(),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
  archiveLead: vi.fn(),
}));

vi.mock("@/features/crm/services/customersService", () => ({
  listCustomers: (...args: unknown[]) => mockListCustomers(...args),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  archiveCustomer: vi.fn(),
}));

vi.mock("@/features/auth", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
  return {
    ...actual,
    getMe: (...args: unknown[]) => mockGetMe(...args),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function customerFixture(overrides: Partial<Customer> = {}): Customer {
  return {
    id: CUST_1,
    companyId: "co1",
    companyName: "Nordic Widgets",
    industry: null,
    website: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    country: null,
    notes: null,
    ownerId: null,
    status: "active",
    source: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

function leadFixture(overrides: Partial<Lead> = {}): Lead {
  return {
    id: LEAD_1,
    companyId: "co1",
    customerId: CUST_1,
    pipelineStage: "qualified",
    estimatedValue: "15000.00",
    probability: 40,
    expectedCloseDate: "2026-12-01",
    assignedTo: USER_1,
    notes: "Discovery call notes",
    isActive: true,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

function dealFixture(overrides: Partial<Deal> = {}): Deal {
  return {
    id: DEAL_1,
    companyId: "co1",
    leadId: LEAD_1,
    value: "12500.00",
    currency: "USD",
    status: "open",
    wonAt: null,
    lostReason: null,
    isActive: true,
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-02-01T10:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

function page(
  items: Deal[],
  meta: Partial<Paginated<Deal>["meta"]> = {},
): Paginated<Deal> {
  return {
    items,
    meta: {
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: 1,
      ...meta,
    },
  };
}

function leadsPage(items: Lead[]): Paginated<Lead> {
  return {
    items,
    meta: { page: 1, pageSize: 100, total: items.length, totalPages: 1 },
  };
}

function customersPage(items: Customer[]): Paginated<Customer> {
  return {
    items,
    meta: { page: 1, pageSize: 100, total: items.length, totalPages: 1 },
  };
}

function renderPage(
  initialEntry = "/crm/deals",
  permissions: string[] = [
    "deals.read",
    "deals.create",
    "deals.update",
    "deals.delete",
    "leads.read",
    "customers.read",
  ],
) {
  mockGetMe.mockResolvedValue({
    user: {
      id: USER_1,
      email: "owner@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      role: "owner",
      companyId: "co1",
      companyName: "Test Co",
      companySlug: "test-co",
      emailVerified: true,
    },
    permissions,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/crm/deals" element={<DealsPage />} />
          <Route path="/crm/leads" element={<div>Leads route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DealsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: USER_1,
        email: "owner@example.com",
        name: "Ada Lovelace",
        role: "owner",
        companyId: "co1",
        companyName: "Test Co",
        companySlug: "test-co",
      },
    });
    mockListCustomers.mockResolvedValue(customersPage([customerFixture()]));
    mockListLeads.mockResolvedValue(leadsPage([leadFixture()]));
    // Bound-lead-ids query + list share listDeals; default unbound.
    mockListDeals.mockResolvedValue(page([]));
  });

  it("shows loading then empty when no deals but leads exist", async () => {
    let resolveList: (value: Paginated<Deal>) => void = () => undefined;
    mockListDeals.mockImplementation(
      () =>
        new Promise<Paginated<Deal>>((resolve) => {
          resolveList = resolve;
        }),
    );

    renderPage();
    expect(screen.getByLabelText("Loading deals")).toBeInTheDocument();
    resolveList(page([]));
    expect(await screen.findByText("No deals yet")).toBeInTheDocument();
  });

  it("shows lead prerequisite when zero leads", async () => {
    mockListDeals.mockResolvedValue(page([]));
    mockListLeads.mockResolvedValue(leadsPage([]));
    renderPage();
    expect(await screen.findByText("Create a lead first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Leads" })).toBeInTheDocument();
  });

  it("renders populated list with lead/customer labels from options cache", async () => {
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    renderPage();
    expect(
      await screen.findByLabelText(/Open deal Nordic Widgets/i),
    ).toBeInTheDocument();
    expect(screen.getByText("12,500 USD")).toBeInTheDocument();
    expect(mockGetLead).not.toHaveBeenCalled();
  });

  it("does not render a search control", async () => {
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    renderPage();
    await screen.findByLabelText(/Open deal Nordic Widgets/i);
    expect(screen.queryByLabelText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("filters by status via chips", async () => {
    const user = userEvent.setup();
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    renderPage();
    await screen.findByLabelText(/Open deal Nordic Widgets/i);
    await user.click(screen.getByRole("button", { name: "Won" }));
    await waitFor(() => {
      expect(mockListDeals).toHaveBeenCalledWith(
        expect.objectContaining({ status: "won", page: 1 }),
        expect.anything(),
      );
    });
  });

  it("filters by leadId", async () => {
    const user = userEvent.setup();
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    mockListLeads.mockResolvedValue(
      leadsPage([
        leadFixture(),
        leadFixture({ id: LEAD_2, notes: "Second opportunity" }),
      ]),
    );
    renderPage();
    await screen.findByLabelText(/Open deal Nordic Widgets/i);
    await user.selectOptions(screen.getByLabelText("Filter by lead"), LEAD_2);
    await waitFor(() => {
      expect(mockListDeals).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: LEAD_2, page: 1 }),
        expect.anything(),
      );
    });
  });

  it("sorts by value", async () => {
    const user = userEvent.setup();
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    renderPage();
    await screen.findByLabelText(/Open deal Nordic Widgets/i);
    await user.click(screen.getByRole("button", { name: /Sort by Value/i }));
    await waitFor(() => {
      expect(mockListDeals).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "value" }),
        expect.anything(),
      );
    });
  });

  it("shows error with retry", async () => {
    const user = userEvent.setup();
    mockListDeals
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("Deals couldn't load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No deals yet")).toBeInTheDocument();
  });

  it("creates a deal without protected fields", async () => {
    const user = userEvent.setup();
    mockListDeals.mockResolvedValue(page([]));
    mockCreateDeal.mockResolvedValue(dealFixture({ value: "2500" }));
    mockGetDeal.mockResolvedValue(dealFixture({ value: "2500" }));

    renderPage();
    await screen.findByText("No deals yet");
    await user.click(screen.getByRole("button", { name: "New deal" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/^Lead/i), LEAD_1);
    await user.type(within(dialog).getByLabelText(/^Value/i), "2500");
    const currency = within(dialog).getByLabelText(/^Currency/i);
    await user.clear(currency);
    await user.type(currency, "EUR");
    await user.click(within(dialog).getByRole("button", { name: "Create deal" }));

    await waitFor(() => {
      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: LEAD_1,
          value: 2500,
          currency: "EUR",
          status: "open",
        }),
      );
    });
    const payload = mockCreateDeal.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("companyId");
    expect(payload).not.toHaveProperty("customerId");
    expect(payload).not.toHaveProperty("id");
  });

  it("surfaces duplicate active deal validation", async () => {
    const user = userEvent.setup();
    mockListDeals.mockResolvedValue(page([]));
    mockCreateDeal.mockRejectedValue(
      new ApiRequestError("This lead already has an active deal.", [
        { code: "validation_error", detail: "This lead already has an active deal." },
      ]),
    );
    const { toast } = await import("sonner");
    renderPage();
    await screen.findByText("No deals yet");
    await user.click(screen.getByRole("button", { name: "New deal" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/^Lead/i), LEAD_1);
    await user.type(within(dialog).getByLabelText(/^Value/i), "100");
    await user.click(within(dialog).getByRole("button", { name: "Create deal" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "This lead already has an active deal.",
      );
    });
  });

  it("changes status via PATCH without mutating Lead", async () => {
    const user = userEvent.setup();
    const existing = dealFixture();
    mockListDeals.mockResolvedValue(page([existing]));
    mockGetDeal.mockResolvedValue(existing);
    mockUpdateDeal.mockResolvedValue({ ...existing, status: "won" });

    renderPage(`/crm/deals?deal=${DEAL_1}`);
    expect(await screen.findByLabelText("Change deal status")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Change deal status"), "won");
    await waitFor(() => {
      expect(mockUpdateDeal).toHaveBeenCalledWith(
        DEAL_1,
        expect.objectContaining({ status: "won" }),
      );
    });
    expect(mockUpdateLead).not.toHaveBeenCalled();
  });

  it("edits without sending leadId in PATCH", async () => {
    const user = userEvent.setup();
    const existing = dealFixture();
    mockListDeals.mockResolvedValue(page([existing]));
    mockGetDeal.mockResolvedValue(existing);
    mockUpdateDeal.mockResolvedValue({ ...existing, value: "13000" });

    renderPage(`/crm/deals?deal=${DEAL_1}`);
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("combobox", { name: /^Lead/i }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/cannot be changed/i),
    ).toBeInTheDocument();
    const value = within(dialog).getByLabelText(/^Value/i);
    await user.clear(value);
    await user.type(value, "13000");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateDeal).toHaveBeenCalled();
    });
    const payload = mockUpdateDeal.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ value: 13000, currency: "USD" });
    expect(payload).not.toHaveProperty("leadId");
    expect(payload).not.toHaveProperty("customerId");
  });

  it("archives after confirmation", async () => {
    const user = userEvent.setup();
    const existing = dealFixture();
    mockListDeals.mockResolvedValue(page([existing]));
    mockGetDeal.mockResolvedValue(existing);
    mockArchiveDeal.mockResolvedValue(undefined);

    renderPage(`/crm/deals?deal=${DEAL_1}`);
    await screen.findByRole("button", { name: "Archive" });
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockArchiveDeal).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockArchiveDeal).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockArchiveDeal).toHaveBeenCalledWith(DEAL_1);
    });
  });

  it("hides mutation actions without write permissions", async () => {
    mockListDeals.mockResolvedValue(page([dealFixture()]));
    mockGetDeal.mockResolvedValue(dealFixture());
    renderPage(`/crm/deals?deal=${DEAL_1}`, [
      "deals.read",
      "leads.read",
      "customers.read",
    ]);

    expect(await screen.findByRole("heading", { name: /12[,.]?500 USD/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New deal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Change deal status")).not.toBeInTheDocument();
  });

  it("still shows Deals workspace chrome with deals.read even if leads.read is present alone elsewhere", async () => {
    // Explicit: leads.read alone is insufficient for this page's create/options,
    // but the page itself assumes PermissionRoute(deals.read). With only leads.read
    // the user would never reach DealsPage; here we assert deals.create is gated.
    mockListDeals.mockResolvedValue(page([]));
    renderPage("/crm/deals", ["deals.read", "leads.read", "customers.read"]);
    expect(await screen.findByText("No deals yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New deal" })).not.toBeInTheDocument();
  });
});
