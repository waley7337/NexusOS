import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeesPage } from "../EmployeesPage";
import { useAuthStore } from "@/stores/auth";
import type { Employee } from "../../types";
import type { Paginated } from "@/types/api";

const mockListEmployees = vi.fn();
const mockCreateEmployee = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/hr/services/employeesService", () => ({
  listEmployees: (...args: unknown[]) => mockListEmployees(...args),
  getEmployee: vi.fn(),
  createEmployee: (...args: unknown[]) => mockCreateEmployee(...args),
  updateEmployee: vi.fn(),
  archiveEmployee: vi.fn(),
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

function employeeFixture(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "e1",
    companyId: "co1",
    userId: null,
    firstName: "Pat",
    lastName: "Worker",
    fullName: "Pat Worker",
    workEmail: "pat@example.com",
    employeeNumber: "EMP-001",
    department: "Engineering",
    managerId: null,
    hireDate: "2026-01-01",
    employmentType: "full_time",
    status: "active",
    isActive: true,
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
    createdBy: "u1",
    updatedBy: "u1",
    deletedAt: null,
    ...overrides,
  };
}

function page(items: Employee[], meta: Partial<Paginated<Employee>["meta"]> = {}): Paginated<Employee> {
  return {
    items,
    meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1, ...meta },
  };
}

function renderPage(
  initialEntry = "/hr/employees",
  permissions: string[] = [
    "employees.read",
    "employees.create",
    "employees.update",
    "employees.delete",
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
          <Route path="/hr/employees" element={<EmployeesPage />} />
          <Route path="/hr" element={<EmployeesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmployeesPage", () => {
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

  it("shows loading then empty state", async () => {
    mockListEmployees.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
  });

  it("renders list without salaryGrade", async () => {
    mockListEmployees.mockResolvedValue(page([employeeFixture()]));
    renderPage();
    expect(await screen.findByText("Pat Worker")).toBeInTheDocument();
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument();
    const json = JSON.stringify(mockListEmployees.mock.results);
    expect(json).not.toContain("salaryGrade");
  });

  it("debounces search", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockListEmployees.mockResolvedValue(page([employeeFixture()]));
    renderPage();
    await screen.findByText("Pat Worker");

    await user.type(screen.getByLabelText("Search employees"), "pat");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(mockListEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ search: "pat" }),
        expect.anything(),
      );
    });
    vi.useRealTimers();
  });

  it("creates HR-only employee", async () => {
    const user = userEvent.setup();
    mockListEmployees.mockResolvedValue(page([]));
    mockCreateEmployee.mockResolvedValue(employeeFixture({ firstName: "New" }));

    renderPage();
    await screen.findByText("No employees yet");
    await user.click(screen.getByRole("button", { name: "Add employee" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/First name/i), "New");
    await user.type(within(dialog).getByLabelText(/Last name/i), "Hire");
    await user.type(within(dialog).getByLabelText(/Employee number/i), "EMP-NEW");
    await user.click(within(dialog).getByRole("button", { name: "Create employee" }));

    await waitFor(() => {
      expect(mockCreateEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeNumber: "EMP-NEW",
          firstName: "New",
          lastName: "Hire",
          userId: null,
        }),
      );
    });
  });

  it("manager view shows scoped sections", async () => {
    mockListEmployees.mockResolvedValue(
      page([
        employeeFixture({ id: "self", userId: "u1", fullName: "Me Manager" }),
        employeeFixture({ id: "rep", fullName: "Direct Report", managerId: "self" }),
      ]),
    );
    renderPage("/hr/employees", ["employees.read_team", "employees.read_self"]);

    expect(await screen.findByRole("heading", { name: "HR" })).toBeInTheDocument();
    expect(await screen.findByText("My employment")).toBeInTheDocument();
    expect(await screen.findByText("My team")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New employee" })).not.toBeInTheDocument();
  });

  it("employee self view hides directory controls", async () => {
    mockListEmployees.mockResolvedValue(
      page([employeeFixture({ userId: "u1", fullName: "Only Me" })]),
    );
    renderPage("/hr/employees", ["employees.read_self"]);

    expect(await screen.findByText("Only Me")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search employees")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New employee" })).not.toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    const user = userEvent.setup();
    mockListEmployees.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText("Employees couldn't load")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
  });
});
