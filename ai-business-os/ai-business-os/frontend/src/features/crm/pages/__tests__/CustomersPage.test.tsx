import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersPage } from "../CustomersPage";
import { useAuthStore } from "@/stores/auth";
import { ApiRequestError } from "@/api/client";
import type { Customer } from "../../types";
import type { Paginated } from "@/types/api";

const mockListCustomers = vi.fn();
const mockGetCustomer = vi.fn();
const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockArchiveCustomer = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/crm/services/customersService", () => ({
  listCustomers: (...args: unknown[]) => mockListCustomers(...args),
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
  createCustomer: (...args: unknown[]) => mockCreateCustomer(...args),
  updateCustomer: (...args: unknown[]) => mockUpdateCustomer(...args),
  archiveCustomer: (...args: unknown[]) => mockArchiveCustomer(...args),
}));

vi.mock("@/features/auth", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
  return {
    ...actual,
    getMe: (...args: unknown[]) => mockGetMe(...args),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function customerFixture(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    companyId: "co1",
    companyName: "Nordic Widgets",
    industry: "Manufacturing",
    website: null,
    email: "hello@nordic.example",
    phone: "+47-555",
    address: null,
    city: "Oslo",
    country: "Norway",
    notes: null,
    ownerId: "u1",
    status: "active",
    source: null,
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
  items: Customer[],
  meta: Partial<Paginated<Customer>["meta"]> = {},
): Paginated<Customer> {
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

function renderPage(initialEntry = "/crm", permissions: string[] = [
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
]) {
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
          <Route path="/crm" element={<CustomersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CustomersPage", () => {
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
  });

  it("shows a loading state then the empty state", async () => {
    let resolveList: (value: Paginated<Customer>) => void = () => undefined;
    mockListCustomers.mockImplementation(
      () =>
        new Promise<Paginated<Customer>>((resolve) => {
          resolveList = resolve;
        }),
    );

    renderPage();
    expect(screen.getByLabelText("Loading customers")).toBeInTheDocument();

    resolveList(page([]));
    expect(await screen.findByText("No customers yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add customer" })).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("renders a populated list from the API", async () => {
    mockListCustomers.mockResolvedValue(
      page([customerFixture(), customerFixture({ id: "c2", companyName: "Harbor Labs", status: "lead" })]),
    );
    renderPage();

    expect(await screen.findByText("Nordic Widgets")).toBeInTheDocument();
    expect(screen.getByText("Harbor Labs")).toBeInTheDocument();
    expect(screen.getByText(/2 customers/)).toBeInTheDocument();
  });

  it("paginates via URL state", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockResolvedValue(
      page([customerFixture()], { page: 1, pageSize: 20, total: 40, totalPages: 2 }),
    );
    renderPage();

    expect(await screen.findByText("Nordic Widgets")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => {
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      );
    });
  });

  it("debounces search into the list query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockListCustomers.mockResolvedValue(page([customerFixture()]));
    renderPage();
    await screen.findByText("Nordic Widgets");

    await user.type(screen.getByLabelText("Search customers"), "nordic");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "nordic", page: 1 }),
        expect.anything(),
      );
    });
    vi.useRealTimers();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockResolvedValue(page([customerFixture()]));
    renderPage();
    await screen.findByText("Nordic Widgets");

    await user.selectOptions(screen.getByLabelText("Filter by status"), "active");
    await waitFor(() => {
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", page: 1 }),
        expect.anything(),
      );
    });
  });

  it("sorts by company name", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockResolvedValue(page([customerFixture()]));
    renderPage();
    await screen.findByText("Nordic Widgets");

    await user.click(screen.getByRole("button", { name: /Company/i }));
    await waitFor(() => {
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "company_name" }),
        expect.anything(),
      );
    });
  });

  it("shows error with retry", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText("Customers couldn't load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No customers yet")).toBeInTheDocument();
  });

  it("creates a customer through the form", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockResolvedValue(page([]));
    mockCreateCustomer.mockResolvedValue(customerFixture({ companyName: "New Co" }));
    mockGetCustomer.mockResolvedValue(customerFixture({ companyName: "New Co" }));

    renderPage();
    await screen.findByText("No customers yet");
    await user.click(screen.getByRole("button", { name: "New customer" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Company name/i), "New Co");
    await user.click(within(dialog).getByRole("button", { name: "Create customer" }));

    await waitFor(() => {
      expect(mockCreateCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: "New Co",
          status: "lead",
        }),
      );
    });
    const payload = mockCreateCustomer.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("companyId");
    expect(payload).not.toHaveProperty("createdBy");
    expect(payload).not.toHaveProperty("id");
  });

  it("edits a customer from detail", async () => {
    const user = userEvent.setup();
    const existing = customerFixture();
    mockListCustomers.mockResolvedValue(page([existing]));
    mockGetCustomer.mockResolvedValue(existing);
    mockUpdateCustomer.mockResolvedValue({ ...existing, companyName: "Nordic Widgets AS" });

    renderPage("/crm?customer=c1");
    expect(await screen.findByRole("heading", { name: "Nordic Widgets" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByLabelText(/Company name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Nordic Widgets AS");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateCustomer).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ companyName: "Nordic Widgets AS" }),
      );
    });
  });

  it("archives only after confirmation", async () => {
    const user = userEvent.setup();
    const existing = customerFixture();
    mockListCustomers.mockResolvedValue(page([existing]));
    mockGetCustomer.mockResolvedValue(existing);
    mockArchiveCustomer.mockResolvedValue(undefined);

    renderPage("/crm?customer=c1");
    await screen.findByRole("heading", { name: "Nordic Widgets" });

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockArchiveCustomer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockArchiveCustomer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(mockArchiveCustomer).toHaveBeenCalledWith("c1");
    });
  });

  it("hides mutation actions without permissions", async () => {
    mockListCustomers.mockResolvedValue(page([customerFixture()]));
    mockGetCustomer.mockResolvedValue(customerFixture());
    renderPage("/crm?customer=c1", ["customers.read"]);

    expect(await screen.findByRole("heading", { name: "Nordic Widgets" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New customer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("surfaces backend validation errors on create", async () => {
    const user = userEvent.setup();
    mockListCustomers.mockResolvedValue(page([]));
    mockCreateCustomer.mockRejectedValue(
      new ApiRequestError("Invalid input.", [{ code: "validation_error", detail: "bad" }]),
    );

    const { toast } = await import("sonner");
    renderPage();
    await screen.findByText("No customers yet");
    await user.click(screen.getByRole("button", { name: "New customer" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Company name/i), "X");
    await user.click(within(dialog).getByRole("button", { name: "Create customer" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid input.");
    });
  });
});
