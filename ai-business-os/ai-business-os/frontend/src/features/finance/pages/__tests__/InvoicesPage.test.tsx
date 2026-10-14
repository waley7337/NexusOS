import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvoicesPage } from "../InvoicesPage";
import { InvoiceDetailPage } from "../InvoiceDetailPage";
import { PermissionRoute } from "@/routes/PermissionRoute";
import { useAuthStore } from "@/stores/auth";
import type { Invoice } from "../../types";
import { ApiRequestError } from "@/api/client";

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), send: vi.fn(), voidInvoice: vi.fn(), archive: vi.fn(), me: vi.fn(), customers: vi.fn() }));
vi.mock("@/features/finance/services/invoicesService", () => ({ listInvoices: api.list, getInvoice: api.get, createInvoice: api.create, updateInvoice: api.update, sendInvoice: api.send, voidInvoice: api.voidInvoice, archiveInvoice: api.archive }));
vi.mock("@/features/crm/services/customersService", () => ({ listCustomers: api.customers }));
vi.mock("@/features/auth", async () => ({ ...(await vi.importActual<object>("@/features/auth")), getMe: api.me }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const invoice: Invoice = { id: "i1", companyId: "co1", customerId: "c1", customerName: "Exact Customer Name", invoiceNumber: "INV-001", issueDate: "2026-08-01", dueDate: "2026-08-31", status: "draft", subtotal: "0.30", tax: "0.01", total: "0.31", currency: "USD", sentAt: null, voidedAt: null, items: [{ id: "li1", description: "Precision", quantity: "0.1", unitPrice: "3.00", total: "0.30" }], amountPaid: "0.00", outstandingBalance: "0.31", isActive: true, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", createdBy: "u1", updatedBy: null, deletedAt: null };
const page = (items: Invoice[]) => ({ items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } });

function renderAt(path: string, permissions: string[]) {
  api.me.mockResolvedValue({ user: { id: "u1" }, permissions });
  useAuthStore.setState({ accessToken: "token", refreshToken: "refresh", user: { id: "u1", email: "a@b.co", name: "Ada", role: "owner", companyId: "co1", companyName: "Co", companySlug: "co" } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route element={<PermissionRoute permission="invoices.read" />}><Route path="/finance/invoices" element={<InvoicesPage />} /><Route path="/finance/invoices/:invoiceId" element={<InvoiceDetailPage />} /></Route><Route path="/403" element={<h1>Forbidden</h1>} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe("Invoices workspace", () => {
  beforeEach(() => { vi.clearAllMocks(); api.customers.mockResolvedValue({ items: [{ id: "c1", companyName: "Exact Customer Name" }], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }); api.create.mockResolvedValue(invoice); });
  it("gates workspace access with invoices.read", async () => { api.list.mockResolvedValue(page([])); renderAt("/finance/invoices", []); expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument(); expect(api.list).not.toHaveBeenCalled(); });
  it("distinguishes loading, empty, and API-backed populated states", async () => { let resolve!: (value: ReturnType<typeof page>) => void; api.list.mockReturnValue(new Promise((done) => { resolve = done; })); const view = renderAt("/finance/invoices", ["invoices.read"]); expect(await screen.findByLabelText("Loading invoices")).toBeInTheDocument(); resolve(page([])); expect(await screen.findByText("No invoices yet")).toBeInTheDocument(); expect(screen.getByPlaceholderText("Search invoice number…")).toBeInTheDocument(); view.unmount(); api.list.mockResolvedValue(page([invoice])); renderAt("/finance/invoices", ["invoices.read"]); expect(await screen.findByRole("link", { name: "INV-001" })).toHaveAttribute("href", "/finance/invoices/i1"); expect(screen.getByText("USD 0.31")).toBeInTheDocument(); expect(screen.getAllByText("Exact Customer Name").length).toBeGreaterThanOrEqual(1); expect(screen.queryByRole("link", { name: /Exact Customer Name/ })).not.toBeInTheDocument(); });
  it("keeps API failures distinct from empty results", async () => { api.list.mockRejectedValue(new Error("offline")); renderAt("/finance/invoices", ["invoices.read"]); expect(await screen.findByText("Invoices could not be loaded")).toBeInTheDocument(); expect(screen.queryByText("No invoices yet")).not.toBeInTheDocument(); });
  it("sends status filters and pagination to the API", async () => { const user = userEvent.setup(); api.list.mockResolvedValue({ items: [invoice], meta: { page: 1, pageSize: 20, total: 40, totalPages: 2 } }); renderAt("/finance/invoices", ["invoices.read"]); await screen.findByRole("link", { name: "INV-001" }); await user.selectOptions(screen.getByLabelText("Filter invoices by status"), "draft"); await waitFor(() => expect(api.list.mock.calls.some(([params]) => params.status === "draft")).toBe(true)); await user.click(screen.getByRole("button", { name: "Next page" })); await waitFor(() => expect(api.list.mock.calls.some(([params]) => params.page === 2)).toBe(true)); });
  it("sends customerId to the API and resets pagination when the customer filter changes", async () => {
    const user = userEvent.setup();
    api.customers.mockResolvedValue({
      items: [
        { id: "c1", companyName: "Exact Customer Name" },
        { id: "c2", companyName: "Second Customer" },
      ],
      meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    });
    api.list.mockResolvedValue({ items: [invoice], meta: { page: 2, pageSize: 20, total: 40, totalPages: 2 } });
    renderAt("/finance/invoices?page=2", ["invoices.read"]);
    await screen.findByRole("link", { name: "INV-001" });
    await waitFor(() => expect(screen.getByRole("option", { name: "Second Customer" })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Filter invoices by customer"), "c2");
    await waitFor(() =>
      expect(
        api.list.mock.calls.some(
          ([params]) => params.customerId === "c2" && params.page === 1,
        ),
      ).toBe(true),
    );
  });
  it("treats customer-only filters as filtered empty state", async () => {
    api.customers.mockResolvedValue({
      items: [{ id: "c2", companyName: "Second Customer" }],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    api.list.mockResolvedValue(page([]));
    renderAt("/finance/invoices?customerId=c2", ["invoices.read"]);
    expect(await screen.findByText("No matching invoices")).toBeInTheDocument();
    expect(screen.getByText(/status, or customer filter/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(api.list.mock.calls.some(([params]) => params.customerId === "c2")).toBe(true),
    );
  });
  it("shows create only with invoices.create and submits string money fields", async () => { const user = userEvent.setup(); api.list.mockResolvedValue(page([])); api.get.mockResolvedValue(invoice); renderAt("/finance/invoices", ["invoices.read", "invoices.create"]); await user.click(await screen.findByRole("button", { name: "New invoice" })); await user.type(screen.getByLabelText(/^Invoice number/), "INV-001"); await user.selectOptions(screen.getByLabelText(/^Customer/), "c1"); await user.type(screen.getByLabelText(/^Issue date/), "2026-08-01"); await user.type(screen.getByLabelText(/^Due date/), "2026-08-31"); await user.type(screen.getByLabelText(/^Description/), "Precision"); await user.clear(screen.getByLabelText(/^Quantity/)); await user.type(screen.getByLabelText(/^Quantity/), "0.1"); await user.clear(screen.getByLabelText(/^Unit price/)); await user.type(screen.getByLabelText(/^Unit price/), "3.00"); await user.click(screen.getByRole("button", { name: "Create invoice" })); await waitFor(() => expect(api.create).toHaveBeenCalled()); expect(api.create.mock.calls[0][0]).toEqual(expect.objectContaining({ tax: "0", items: [expect.objectContaining({ quantity: "0.1", unitPrice: "3" })] })); });
  it("renders exact backend totals and permission-gated draft lifecycle controls", async () => { api.get.mockResolvedValue(invoice); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update", "invoices.send", "invoices.delete"]); expect(await screen.findByText("Exact Customer Name")).toBeInTheDocument(); expect(screen.getByText("0.31")).toBeInTheDocument(); expect(screen.getByTestId("invoice-amount-paid")).toHaveTextContent("USD 0.00"); expect(screen.getByTestId("invoice-outstanding-balance")).toHaveTextContent("USD 0.31"); expect(screen.getByRole("button", { name: /Edit draft/ })).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Mark as sent/ })).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Void/ })).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Archive/ })).toBeInTheDocument(); });
  it("renders API-provided payment summary without recomputing totals", async () => {
    api.get.mockResolvedValue({
      ...invoice,
      status: "partially_paid",
      amountPaid: "12.50",
      outstandingBalance: "87.50",
      total: "100.00",
    });
    renderAt("/finance/invoices/i1", ["invoices.read"]);
    expect(await screen.findByTestId("invoice-amount-paid")).toHaveTextContent("USD 12.50");
    expect(screen.getByTestId("invoice-outstanding-balance")).toHaveTextContent("USD 87.50");
    expect(screen.getByText("100.00")).toBeInTheDocument();
  });
  it("renders detail errors and hides draft-only actions for sent invoices", async () => { api.get.mockRejectedValueOnce(new Error("missing")); const view = renderAt("/finance/invoices/missing", ["invoices.read"]); expect(await screen.findByText("Invoice unavailable")).toBeInTheDocument(); view.unmount(); api.get.mockResolvedValue({ ...invoice, status: "sent", sentAt: "2026-08-18T10:00:00Z" }); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update", "invoices.send", "invoices.delete"]); await screen.findByText("Exact Customer Name"); expect(screen.queryByRole("button", { name: /Edit draft/ })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /Mark as sent/ })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: /Void/ })).toBeInTheDocument(); });
  it("hides void for paid, void, and partially_paid while keeping it for eligible statuses", async () => {
    for (const status of ["paid", "void", "partially_paid"] as const) {
      api.get.mockResolvedValue({ ...invoice, status });
      const view = renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update"]);
      await screen.findByText("Exact Customer Name");
      expect(screen.queryByRole("button", { name: /^Void$/ })).not.toBeInTheDocument();
      view.unmount();
    }
    for (const status of ["draft", "sent", "overdue"] as const) {
      api.get.mockResolvedValue({ ...invoice, status, sentAt: status === "draft" ? null : "2026-08-18T10:00:00Z" });
      const view = renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update"]);
      expect(await screen.findByRole("button", { name: /^Void$/ })).toBeInTheDocument();
      view.unmount();
    }
  });
  it("still requires invoices.update permission to show void on eligible invoices", async () => {
    api.get.mockResolvedValue({ ...invoice, status: "sent", sentAt: "2026-08-18T10:00:00Z" });
    renderAt("/finance/invoices/i1", ["invoices.read"]);
    await screen.findByText("Exact Customer Name");
    expect(screen.queryByRole("button", { name: /^Void$/ })).not.toBeInTheDocument();
  });
  it("confirms send as an internal transition and refreshes detail", async () => { const user = userEvent.setup(); api.get.mockResolvedValue(invoice); api.send.mockResolvedValue({ ...invoice, status: "sent", sentAt: "2026-08-18T10:00:00Z" }); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.send"]); await user.click(await screen.findByRole("button", { name: /Mark as sent/ })); expect(screen.getByText(/does not email the customer or create a PDF/i)).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Mark as sent" })); await waitFor(() => expect(api.send).toHaveBeenCalled()); expect(api.send.mock.calls[0][0]).toBe("i1"); });
  it("confirms and completes a successful void transition", async () => { const user = userEvent.setup(); api.get.mockResolvedValue(invoice); api.voidInvoice.mockResolvedValue({ ...invoice, status: "void", voidedAt: "2026-08-18T11:00:00Z" }); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update"]); await user.click(await screen.findByRole("button", { name: "Void" })); expect(screen.getByText(/move to VOID.*does not delete/i)).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Void invoice" })); await waitFor(() => expect(api.voidInvoice).toHaveBeenCalled()); expect(api.voidInvoice.mock.calls[0][0]).toBe("i1"); expect(await screen.findByText("void")).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Void" })).not.toBeInTheDocument(); });
  it("confirms and completes a successful draft soft-archive", async () => { const user = userEvent.setup(); api.get.mockResolvedValue(invoice); api.archive.mockResolvedValue(undefined); api.list.mockResolvedValue(page([])); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.delete"]); await user.click(await screen.findByRole("button", { name: "Archive" })); expect(screen.getByText(/soft-archived and removed from the active list/i)).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Archive draft" })); await waitFor(() => expect(api.archive).toHaveBeenCalled()); expect(api.archive.mock.calls[0][0]).toBe("i1"); expect(await screen.findByText("No invoices yet")).toBeInTheDocument(); });
  it("maps stable backend 422 locations to the matching line-item field", async () => { const user = userEvent.setup(); api.list.mockResolvedValue(page([])); api.create.mockRejectedValue(new ApiRequestError("Invalid input.", [{ code: "validation_error", field: "body.items.0.quantity", detail: "Input should be greater than or equal to 0" }])); renderAt("/finance/invoices", ["invoices.read", "invoices.create"]); await user.click(await screen.findByRole("button", { name: "New invoice" })); await user.type(screen.getByLabelText(/^Invoice number/), "INV-422"); await user.selectOptions(screen.getByLabelText(/^Customer/), "c1"); await user.type(screen.getByLabelText(/^Issue date/), "2026-08-01"); await user.type(screen.getByLabelText(/^Due date/), "2026-08-31"); await user.type(screen.getByLabelText(/^Description/), "Validation"); await user.click(screen.getByRole("button", { name: "Create invoice" })); expect(await screen.findByRole("alert")).toHaveTextContent("greater than or equal to 0"); expect(screen.getByLabelText(/^Quantity/)).toHaveAttribute("aria-invalid", "true"); });
  it("keeps the current edit customer selectable when it is outside bounded options", async () => { const user = userEvent.setup(); const outside = { ...invoice, customerId: "c-outside", customerName: "Outside Customer" }; api.get.mockResolvedValue(outside); renderAt("/finance/invoices/i1", ["invoices.read", "invoices.update"]); await user.click(await screen.findByRole("button", { name: /Edit draft/ })); const customer = screen.getByLabelText(/^Customer/) as HTMLSelectElement; expect(customer.value).toBe("c-outside"); expect(screen.getByRole("option", { name: "Outside Customer" })).toHaveValue("c-outside"); expect(screen.getAllByRole("option", { name: "Outside Customer" })).toHaveLength(1); });
  it("clears edited indexed errors and remaps later-row errors after removal", async () => { const user = userEvent.setup(); api.list.mockResolvedValue(page([])); api.create.mockRejectedValue(new ApiRequestError("Invalid input.", [
    { code: "validation_error", field: "body.items.0.quantity", detail: "First quantity" },
    { code: "validation_error", field: "body.items.1.unitPrice", detail: "Second price" },
    { code: "validation_error", field: "body.unknown", detail: "Unknown field" },
  ])); renderAt("/finance/invoices", ["invoices.read", "invoices.create"]); await user.click(await screen.findByRole("button", { name: "New invoice" })); await user.click(screen.getByRole("button", { name: /Add line item/ })); await user.type(screen.getByLabelText(/^Invoice number/), "INV-ERR"); await user.selectOptions(screen.getByLabelText(/^Customer/), "c1"); await user.type(screen.getByLabelText(/^Issue date/), "2026-08-01"); await user.type(screen.getByLabelText(/^Due date/), "2026-08-31"); const descriptions = screen.getAllByLabelText(/^Description/); await user.type(descriptions[0], "First"); await user.type(descriptions[1], "Second"); await user.click(screen.getByRole("button", { name: "Create invoice" })); expect(await screen.findByText("First quantity")).toBeInTheDocument(); expect(screen.getByText("Second price")).toBeInTheDocument(); expect(screen.getByText("Invalid input.")).toBeInTheDocument(); const quantities = screen.getAllByLabelText(/^Quantity/); await user.clear(quantities[0]); await user.type(quantities[0], "2"); expect(screen.queryByText("First quantity")).not.toBeInTheDocument(); expect(screen.getByText("Second price")).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Remove line item 1" })); expect(screen.getByText("Second price")).toBeInTheDocument(); expect(screen.getAllByLabelText(/^Unit price/)[0]).toHaveAttribute("aria-invalid", "true"); expect(screen.queryByText("Unknown field")).not.toBeInTheDocument(); });
});
