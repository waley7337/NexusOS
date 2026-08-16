import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactsPage } from "../ContactsPage";
import { useAuthStore } from "@/stores/auth";
import { ApiRequestError } from "@/api/client";
import type { Contact, Customer } from "../../types";
import type { Paginated } from "@/types/api";

const CUST_1 = "11111111-1111-4111-8111-111111111111";
const CUST_2 = "22222222-2222-4222-8222-222222222222";
const CONTACT_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mockListContacts = vi.fn();
const mockGetContact = vi.fn();
const mockCreateContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockArchiveContact = vi.fn();
const mockListCustomers = vi.fn();
const mockGetCustomer = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/crm/services/contactsService", () => ({
  listContacts: (...args: unknown[]) => mockListContacts(...args),
  getContact: (...args: unknown[]) => mockGetContact(...args),
  createContact: (...args: unknown[]) => mockCreateContact(...args),
  updateContact: (...args: unknown[]) => mockUpdateContact(...args),
  archiveContact: (...args: unknown[]) => mockArchiveContact(...args),
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

function contactFixture(overrides: Partial<Contact> = {}): Contact {
  return {
    id: CONTACT_1,
    companyId: "co1",
    customerId: CUST_1,
    firstName: "Ada",
    lastName: "Lovelace",
    position: "Engineer",
    email: "ada@example.com",
    phone: "+47-555",
    linkedin: null,
    notes: null,
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
  items: Contact[],
  meta: Partial<Paginated<Contact>["meta"]> = {},
): Paginated<Contact> {
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
  initialEntry = "/crm/contacts",
  permissions: string[] = [
    "contacts.read",
    "contacts.create",
    "contacts.update",
    "contacts.delete",
    "customers.read",
  ],
) {
  mockGetMe.mockResolvedValue({
    user: {
      id: "u1",
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
          <Route path="/crm/contacts" element={<ContactsPage />} />
          <Route path="/crm/customers" element={<div>Customers route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContactsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "u1",
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

  it("shows loading then empty when no contacts but customers exist", async () => {
    let resolveList: (value: Paginated<Contact>) => void = () => undefined;
    mockListContacts.mockImplementation(
      () =>
        new Promise<Paginated<Contact>>((resolve) => {
          resolveList = resolve;
        }),
    );

    renderPage();
    expect(screen.getByLabelText("Loading contacts")).toBeInTheDocument();
    resolveList(page([]));
    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows customer prerequisite when zero customers", async () => {
    mockListContacts.mockResolvedValue(page([]));
    mockListCustomers.mockResolvedValue(customersPage([]));
    renderPage();
    expect(await screen.findByText("Create a customer first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Customers" })).toBeInTheDocument();
  });

  it("renders populated list with customer name from options cache", async () => {
    mockListContacts.mockResolvedValue(page([contactFixture()]));
    renderPage();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    await waitForCustomerOptions();
    const matches = screen.getAllByText("Nordic Widgets");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Open Ada Lovelace")).toHaveTextContent("Nordic Widgets");
    expect(mockGetCustomer).not.toHaveBeenCalled();
  });

  it("paginates via URL", async () => {
    const user = userEvent.setup();
    mockListContacts.mockResolvedValue(
      page([contactFixture()], { page: 1, total: 40, totalPages: 2 }),
    );
    renderPage();
    await screen.findByText("Ada Lovelace");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(mockListContacts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      );
    });
  });

  it("filters by customerId", async () => {
    const user = userEvent.setup();
    mockListContacts.mockResolvedValue(page([contactFixture()]));
    mockListCustomers.mockResolvedValue(
      customersPage([
        customerFixture(),
        customerFixture({ id: CUST_2, companyName: "Harbor Labs" }),
      ]),
    );
    renderPage();
    await screen.findByText("Ada Lovelace");
    await waitForCustomerOptions();
    expect(await screen.findByRole("option", { name: "Harbor Labs" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filter by customer"), CUST_2);
    await waitFor(() => {
      expect(mockListContacts).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: CUST_2, page: 1 }),
        expect.anything(),
      );
    });
  });

  it("sorts by last_name and first_name via URL", async () => {
    const user = userEvent.setup();
    mockListContacts.mockResolvedValue(page([contactFixture()]));
    renderPage();
    await screen.findByText("Ada Lovelace");
    await user.click(screen.getByRole("button", { name: /Name/i }));
    await waitFor(() => {
      expect(mockListContacts).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "last_name" }),
        expect.anything(),
      );
    });
  });

  it("applies first_name sort from URL state", async () => {
    mockListContacts.mockResolvedValue(page([contactFixture()]));
    renderPage("/crm/contacts?sortBy=first_name&sortDesc=false");
    await screen.findByText("Ada Lovelace");
    await waitFor(() => {
      expect(mockListContacts).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "first_name", sortDesc: false }),
        expect.anything(),
      );
    });
  });

  it("shows error with retry", async () => {
    const user = userEvent.setup();
    mockListContacts.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("Contacts couldn't load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
  });

  it("creates a contact with customerId", async () => {
    const user = userEvent.setup();
    mockListContacts.mockResolvedValue(page([]));
    mockCreateContact.mockResolvedValue(contactFixture({ firstName: "New" }));
    mockGetContact.mockResolvedValue(contactFixture({ firstName: "New" }));

    renderPage();
    await screen.findByText("No contacts yet");
    await waitForCustomerOptions();
    await user.click(screen.getByRole("button", { name: "New contact" }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/Customer/i), CUST_1);
    await user.type(within(dialog).getByLabelText(/First name/i), "New");
    await user.type(within(dialog).getByLabelText(/Last name/i), "Person");
    await user.click(within(dialog).getByRole("button", { name: "Create contact" }));

    await waitFor(() => {
      expect(mockCreateContact).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: CUST_1,
          firstName: "New",
          lastName: "Person",
        }),
      );
    });
    const payload = mockCreateContact.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("companyId");
    expect(payload).not.toHaveProperty("id");
  });

  it("edits a contact", async () => {
    const user = userEvent.setup();
    const existing = contactFixture();
    mockListContacts.mockResolvedValue(page([existing]));
    mockGetContact.mockResolvedValue(existing);
    mockUpdateContact.mockResolvedValue({ ...existing, firstName: "Augusta" });

    renderPage(`/crm/contacts?contact=${CONTACT_1}`);
    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("option", { name: "Nordic Widgets" }),
    ).toBeInTheDocument();
    const first = within(dialog).getByLabelText(/First name/i);
    await user.clear(first);
    await user.type(first, "Augusta");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateContact).toHaveBeenCalledWith(
        CONTACT_1,
        expect.objectContaining({ firstName: "Augusta", customerId: CUST_1 }),
      );
    });
  });

  it("archives after confirmation", async () => {
    const user = userEvent.setup();
    const existing = contactFixture();
    mockListContacts.mockResolvedValue(page([existing]));
    mockGetContact.mockResolvedValue(existing);
    mockArchiveContact.mockResolvedValue(undefined);

    renderPage(`/crm/contacts?contact=${CONTACT_1}`);
    await screen.findByRole("heading", { name: "Ada Lovelace" });
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockArchiveContact).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockArchiveContact).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive" }));
    await waitFor(() => {
      expect(mockArchiveContact).toHaveBeenCalledWith(CONTACT_1);
    });
  });

  it("hides mutation actions without permissions", async () => {
    mockListContacts.mockResolvedValue(page([contactFixture()]));
    mockGetContact.mockResolvedValue(contactFixture());
    renderPage(`/crm/contacts?contact=${CONTACT_1}`, ["contacts.read", "customers.read"]);

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New contact" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("surfaces backend validation errors on create", async () => {
    const user = userEvent.setup();
    mockListContacts.mockResolvedValue(page([]));
    mockCreateContact.mockRejectedValue(
      new ApiRequestError("Invalid input.", [{ code: "validation_error", detail: "bad" }]),
    );
    const { toast } = await import("sonner");
    renderPage();
    await screen.findByText("No contacts yet");
    await waitForCustomerOptions();
    await user.click(screen.getByRole("button", { name: "New contact" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/Customer/i), CUST_1);
    await user.type(within(dialog).getByLabelText(/First name/i), "X");
    await user.type(within(dialog).getByLabelText(/Last name/i), "Y");
    await user.click(within(dialog).getByRole("button", { name: "Create contact" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid input.");
    });
  });
});
