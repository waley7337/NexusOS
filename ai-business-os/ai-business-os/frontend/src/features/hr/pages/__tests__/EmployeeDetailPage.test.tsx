import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeDetailPage } from "../EmployeeDetailPage";
import { useAuthStore } from "@/stores/auth";
import type { Employee } from "../../types";

const mockGetEmployee = vi.fn();
const mockListEmployees = vi.fn();
const mockUpdateEmployee = vi.fn();
const mockArchiveEmployee = vi.fn();
const mockGetMe = vi.fn();

vi.mock("@/features/hr/services/employeesService", () => ({
  listEmployees: (...args: unknown[]) => mockListEmployees(...args),
  getEmployee: (...args: unknown[]) => mockGetEmployee(...args),
  createEmployee: vi.fn(),
  updateEmployee: (...args: unknown[]) => mockUpdateEmployee(...args),
  archiveEmployee: (...args: unknown[]) => mockArchiveEmployee(...args),
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
    userId: "u1",
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

function renderDetail(permissions: string[] = ["employees.read", "employees.read_self"]) {
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

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/hr/employees/e1"]}>
        <Routes>
          <Route path="/hr/employees/:employeeId" element={<EmployeeDetailPage />} />
          <Route path="/hr/employees" element={<div>List</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmployeeDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEmployees.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } });
  });

  it("renders employee without compensation when absent from API", async () => {
    mockGetEmployee.mockResolvedValue(employeeFixture());
    renderDetail(["employees.read_team", "employees.read_self"]);
    expect(await screen.findByRole("heading", { name: "Pat Worker", level: 3 })).toBeInTheDocument();
    expect(screen.queryByText("Compensation")).not.toBeInTheDocument();
  });

  it("shows compensation only when API includes salaryGrade", async () => {
    mockGetEmployee.mockResolvedValue(employeeFixture({ salaryGrade: "G5" }));
    renderDetail(["employees.read_self"]);
    expect(await screen.findByText("Compensation")).toBeInTheDocument();
    expect(screen.getByText("G5")).toBeInTheDocument();
  });

  it("shows not found on error", async () => {
    mockGetEmployee.mockRejectedValue(new Error("404"));
    renderDetail();
    expect(await screen.findByText("Employee not found")).toBeInTheDocument();
  });

  it("hides edit controls without update permission", async () => {
    mockGetEmployee.mockResolvedValue(employeeFixture());
    renderDetail(["employees.read_self"]);
    await screen.findByRole("heading", { name: "Pat Worker", level: 3 });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("archives after confirmation", async () => {
    const user = userEvent.setup();
    mockGetEmployee.mockResolvedValue(employeeFixture());
    mockArchiveEmployee.mockResolvedValue(undefined);
    renderDetail([
      "employees.read",
      "employees.update",
      "employees.delete",
    ]);

    await screen.findByRole("button", { name: "Archive" });
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/linked NexusOS user account is not deleted/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Archive employee" }));

    await waitFor(() => {
      expect(mockArchiveEmployee).toHaveBeenCalledWith("e1");
    });
  });
});
