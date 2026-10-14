import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/api/client";
import { PermissionRoute } from "@/routes/PermissionRoute";
import { useAuthStore } from "@/stores/auth";
import { ExpensesPage } from "../ExpensesPage";
import type { Expense } from "../../types";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteExpense: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/features/finance/services/expensesService", () => ({
  listExpenses: api.list,
  getExpense: api.get,
  createExpense: api.create,
  updateExpense: api.update,
  deleteExpense: api.deleteExpense,
}));
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<object>("@/features/auth")),
  getMe: api.me,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const expense: Expense = {
  id: "e1",
  companyId: "c1",
  category: "Travel",
  amount: "42.50",
  currency: "USD",
  description: "Taxi",
  date: "2026-10-01",
  paidBy: null,
  isActive: true,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
};

const page = (items: Expense[]) => ({
  items,
  meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
});

function renderAt(path: string, permissions: string[]) {
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
          <Route element={<PermissionRoute permission="expenses.read" />}>
            <Route path="/finance/expenses" element={<ExpensesPage />} />
          </Route>
          <Route path="/403" element={<h1>Forbidden</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Expenses workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.create.mockResolvedValue(expense);
  });

  it("gates workspace access with expenses.read", async () => {
    api.list.mockResolvedValue(page([]));
    renderAt("/finance/expenses", []);
    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("distinguishes loading, empty, and populated states", async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    api.list.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = renderAt("/finance/expenses", ["expenses.read"]);
    expect(await screen.findByLabelText("Loading expenses")).toBeInTheDocument();
    resolve(page([]));
    expect(await screen.findByText("No expenses yet")).toBeInTheDocument();
    view.unmount();

    api.list.mockResolvedValue(page([expense]));
    renderAt("/finance/expenses", ["expenses.read"]);
    expect(await screen.findByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("USD 42.50")).toBeInTheDocument();
  });

  it("keeps API failures distinct from empty results", async () => {
    api.list.mockRejectedValue(new Error("offline"));
    renderAt("/finance/expenses", ["expenses.read"]);
    expect(await screen.findByText("Expenses could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No expenses yet")).not.toBeInTheDocument();
  });

  it("shows create only with expenses.create and submits payload", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(page([]));
    renderAt("/finance/expenses", ["expenses.read", "expenses.create"]);

    await user.click(await screen.findByRole("button", { name: "New expense" }));
    await user.type(screen.getByLabelText(/^Category/), "Travel");
    await user.type(screen.getByLabelText(/^Date/), "2026-10-01");
    await user.type(screen.getByLabelText(/^Amount/), "42.50");
    await user.click(screen.getByRole("button", { name: "Create expense" }));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({
      category: "Travel",
      amount: "42.50",
      currency: "USD",
      date: "2026-10-01",
    });
  });

  it("maps validation errors onto form fields", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(page([]));
    api.create.mockRejectedValue(
      new ApiRequestError("Invalid input.", [
        {
          code: "validation_error",
          field: "body.amount",
          detail: "Amount must be greater than zero.",
        },
      ]),
    );
    renderAt("/finance/expenses", ["expenses.read", "expenses.create"]);
    await user.click(await screen.findByRole("button", { name: "New expense" }));
    await user.type(screen.getByLabelText(/^Category/), "Travel");
    await user.type(screen.getByLabelText(/^Date/), "2026-10-01");
    await user.type(screen.getByLabelText(/^Amount/), "0");
    await user.click(screen.getByRole("button", { name: "Create expense" }));
    expect(await screen.findByText("Amount must be greater than zero.")).toBeInTheDocument();
  });
});
