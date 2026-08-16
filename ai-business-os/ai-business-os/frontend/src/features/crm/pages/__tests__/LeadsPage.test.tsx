import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadsPage } from "../LeadsPage";
import { useAuthStore } from "@/stores/auth";
import { ApiRequestError } from "@/api/client";
import type { Customer, Lead } from "../../types";
import type { Paginated } from "@/types/api";

const CUST_1 = "11111111-1111-4111-8111-111111111111";
const CUST_2 = "22222222-2222-4222-8222-222222222222";
const LEAD_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_1 = "u1";

const mockListLeads = vi.fn();
const mockGetLead = vi.fn();
const mockCreateLead = vi.fn();
const mockUpdateLead = vi.fn();
const mockArchiveLead = vi.fn();
const mockListCustomers = vi.fn();
const mockGetCustomer = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/crm/services/leadsService", () => ({
  listLeads: (...args: unknown[]) => mockListLeads(...args),
  getLead: (...args: unknown[]) => mockGetLead(...args),
  createLead: (...args: unknown[]) => mockCreateLead(...args),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
  archiveLead: (...args: unknown[]) => mockArchiveLead(...args),
}));

vi.mock("@/features/crm/services/customersService", () => ({
  listCustomers: (...args: unknown[]) => mockListCustomers(...args),
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
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

function page(
  items: Lead[],
  meta: Partial<Paginated<Lead>["meta"]> = {},
): Paginated<Lead> {
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

function customersPage(items: Customer[]): Paginated<Customer> {
  return {
    items,
    meta: { page: 1, pageSize: 100, total: items.length, totalPages: 1 },
  };
}

async function waitForCustomerOptions() {
  expect(await screen.findByRole("option", { name: "Nordic Widgets" })).toBeInTheDocument();
}

function renderPage(
  initialEntry = "/crm/leads",
  permissions: string[] = [
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.delete",
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
          <Route path="/crm/leads" element={<LeadsPage />} />
          <Route path="/crm/customers" element={<div>Customers route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeadsPage", () => {
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
  });

  it("shows loading then empty when no leads but customers exist", async () => {
    let resolveList: (value: Paginated<Lead>) => void = () => undefined;
    mockListLeads.mockImplementation(
      () =>
        new Promise<Paginated<Lead>>((resolve) => {
          resolveList = resolve;
        }),
    );

    renderPage();
    expect(screen.getByLabelText("Loading leads")).toBeInTheDocument();
    resolveList(page([]));
    expect(await screen.findByText("No leads yet")).toBeInTheDocument();
  });

  it("shows customer prerequisite when zero customers", async () => {
    mockListLeads.mockResolvedValue(page([]));
    mockListCustomers.mockResolvedValue(customersPage([]));
    renderPage();
    expect(await screen.findByText("Create a customer first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Customers" })).toBeInTheDocument();
  });

  it("renders populated list with customer name from options cache", async () => {
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    renderPage();
    expect(await screen.findByLabelText("Open lead for Nordic Widgets")).toBeInTheDocument();
    await waitForCustomerOptions();
    expect(mockGetCustomer).not.toHaveBeenCalled();
  });

  it("filters by pipelineStage via stage chips", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    renderPage();
    await screen.findByLabelText("Open lead for Nordic Widgets");
    await user.click(screen.getByRole("button", { name: "Proposal" }));
    await waitFor(() => {
      expect(mockListLeads).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineStage: "proposal", page: 1 }),
        expect.anything(),
      );
    });
  });

  it("filters by customerId", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    mockListCustomers.mockResolvedValue(
      customersPage([
        customerFixture(),
        customerFixture({ id: CUST_2, companyName: "Harbor Labs" }),
      ]),
    );
    renderPage();
    await waitForCustomerOptions();
    expect(await screen.findByRole("option", { name: "Harbor Labs" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filter by customer"), CUST_2);
    await waitFor(() => {
      expect(mockListLeads).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: CUST_2, page: 1 }),
        expect.anything(),
      );
    });
  });

  it("filters assigned to me using current user id", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    renderPage();
    await screen.findByLabelText("Open lead for Nordic Widgets");
    await user.selectOptions(screen.getByLabelText("Filter by assignee"), "me");
    await waitFor(() => {
      expect(mockListLeads).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: USER_1, page: 1 }),
        expect.anything(),
      );
    });
  });

  it("sorts by estimated_value", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    renderPage();
    await screen.findByLabelText("Open lead for Nordic Widgets");
    await user.click(screen.getByRole("button", { name: /Sort by Value/i }));
    await waitFor(() => {
      expect(mockListLeads).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "estimated_value" }),
        expect.anything(),
      );
    });
  });

  it("shows error with retry", async () => {
    const user = userEvent.setup();
    mockListLeads.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("Leads couldn't load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No leads yet")).toBeInTheDocument();
  });

  it("creates a lead without protected fields", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([]));
    mockCreateLead.mockResolvedValue(leadFixture({ notes: "New opp" }));
    mockGetLead.mockResolvedValue(leadFixture({ notes: "New opp" }));

    renderPage();
    await screen.findByText("No leads yet");
    await waitForCustomerOptions();
    await user.click(screen.getByRole("button", { name: "New lead" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/Customer/i), CUST_1);
    await user.selectOptions(within(dialog).getByLabelText(/Pipeline stage/i), "proposal");
    await user.type(within(dialog).getByLabelText(/Estimated value/i), "2500");
    await user.type(within(dialog).getByLabelText(/^Notes/i), "New opp");
    await user.click(within(dialog).getByRole("button", { name: "Create lead" }));

    await waitFor(() => {
      expect(mockCreateLead).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: CUST_1,
          pipelineStage: "proposal",
          estimatedValue: 2500,
          notes: "New opp",
        }),
      );
    });
    const payload = mockCreateLead.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("companyId");
    expect(payload).not.toHaveProperty("id");
  });

  it("changes stage via PATCH", async () => {
    const user = userEvent.setup();
    const existing = leadFixture();
    mockListLeads.mockResolvedValue(page([existing]));
    mockGetLead.mockResolvedValue(existing);
    mockUpdateLead.mockResolvedValue({ ...existing, pipelineStage: "negotiation" });

    renderPage(`/crm/leads?lead=${LEAD_1}`);
    expect(await screen.findByRole("heading", { name: "Nordic Widgets" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Change pipeline stage"), "negotiation");
    await waitFor(() => {
      expect(mockUpdateLead).toHaveBeenCalledWith(
        LEAD_1,
        expect.objectContaining({ pipelineStage: "negotiation" }),
      );
    });
  });

  it("edits a lead", async () => {
    const user = userEvent.setup();
    const existing = leadFixture();
    mockListLeads.mockResolvedValue(page([existing]));
    mockGetLead.mockResolvedValue(existing);
    mockUpdateLead.mockResolvedValue({ ...existing, notes: "Updated" });

    renderPage(`/crm/leads?lead=${LEAD_1}`);
    expect(await screen.findByRole("heading", { name: "Nordic Widgets" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("option", { name: "Nordic Widgets" }),
    ).toBeInTheDocument();
    const notes = within(dialog).getByLabelText(/^Notes/i);
    await user.clear(notes);
    await user.type(notes, "Updated");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateLead).toHaveBeenCalledWith(
        LEAD_1,
        expect.objectContaining({ notes: "Updated", customerId: CUST_1 }),
      );
    });
  });

  it("archives after confirmation", async () => {
    const user = userEvent.setup();
    const existing = leadFixture();
    mockListLeads.mockResolvedValue(page([existing]));
    mockGetLead.mockResolvedValue(existing);
    mockArchiveLead.mockResolvedValue(undefined);

    renderPage(`/crm/leads?lead=${LEAD_1}`);
    await screen.findByRole("heading", { name: "Nordic Widgets" });
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockArchiveLead).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockArchiveLead).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockArchiveLead).toHaveBeenCalledWith(LEAD_1);
    });
  });

  it("hides mutation actions without permissions", async () => {
    mockListLeads.mockResolvedValue(page([leadFixture()]));
    mockGetLead.mockResolvedValue(leadFixture());
    renderPage(`/crm/leads?lead=${LEAD_1}`, ["leads.read", "customers.read"]);

    expect(await screen.findByRole("heading", { name: "Nordic Widgets" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New lead" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Change pipeline stage")).not.toBeInTheDocument();
  });

  it("surfaces backend validation errors on create", async () => {
    const user = userEvent.setup();
    mockListLeads.mockResolvedValue(page([]));
    mockCreateLead.mockRejectedValue(
      new ApiRequestError("Invalid input.", [{ code: "validation_error", detail: "bad" }]),
    );
    const { toast } = await import("sonner");
    renderPage();
    await screen.findByText("No leads yet");
    await waitForCustomerOptions();
    await user.click(screen.getByRole("button", { name: "New lead" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/Customer/i), CUST_1);
    await user.click(within(dialog).getByRole("button", { name: "Create lead" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid input.");
    });
  });
});
