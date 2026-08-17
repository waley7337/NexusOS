import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Link,
  Route,
  RouterProvider,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HrPermissionRoute } from "../HrPermissionRoute";
import { useAuthStore } from "@/stores/auth";
import { ROUTES } from "@/constants/routes";
import { EmployeesPage } from "@/features/hr/pages/EmployeesPage";

const mockGetMe = vi.fn();
const mockListEmployees = vi.fn();

vi.mock("@/features/auth", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
  return {
    ...actual,
    getMe: (...args: unknown[]) => mockGetMe(...args),
  };
});

vi.mock("@/features/hr/services/employeesService", () => ({
  listEmployees: (...args: unknown[]) => mockListEmployees(...args),
  getEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  archiveEmployee: vi.fn(),
}));

function renderShell(permissions: string[], initial: string = ROUTES.hrEmployees) {
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

  mockListEmployees.mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
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

  const routes = createRoutesFromElements(
    <Route
      element={
        <div>
          <nav>
            <Link to={ROUTES.hr}>HR</Link>
            <Link to={ROUTES.hrEmployees}>Employees</Link>
          </nav>
          <main>
            <HrPermissionRoute />
          </main>
        </div>
      }
    >
      <Route path={ROUTES.hr} element={<EmployeesPage />} />
      <Route path={ROUTES.hrEmployees} element={<EmployeesPage />} />
    </Route>,
  );

  const router = createMemoryRouter(routes, { initialEntries: [initial] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HR shell routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows Owner/Admin into HR workspace", async () => {
    renderShell(["employees.read"]);
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
  });

  it("allows Manager with scoped permissions", async () => {
    renderShell(["employees.read_team", "employees.read_self"]);
    expect(await screen.findByText("No employment records")).toBeInTheDocument();
  });

  it("allows Employee self access", async () => {
    renderShell(["employees.read_self"]);
    expect(await screen.findByText("No employment records")).toBeInTheDocument();
  });

  it("denies Viewer with forbidden page", async () => {
    mockGetMe.mockResolvedValue({
      user: {
        id: "u2",
        email: "viewer@example.com",
        firstName: "View",
        lastName: "Only",
        fullName: "View Only",
        role: "viewer",
        companyId: "co1",
        companyName: "Test Co",
        companySlug: "test-co",
        emailVerified: true,
      },
      permissions: ["customers.read"],
    });

    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "u2",
        email: "viewer@example.com",
        name: "View Only",
        role: "viewer",
        companyId: "co1",
        companyName: "Test Co",
        companySlug: "test-co",
      },
    });

    const routes = createRoutesFromElements(
      <Route element={<HrPermissionRoute />}>
        <Route path={ROUTES.hrEmployees} element={<EmployeesPage />} />
      </Route>,
    );
    const router = createMemoryRouter(routes, {
      initialEntries: [ROUTES.hrEmployees],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/don't have permission/i)).toBeInTheDocument();
  });

  it("navigates between /hr and /hr/employees", async () => {
    const user = userEvent.setup();
    renderShell(["employees.read"], ROUTES.hr);
    expect(await screen.findByText("No employees yet")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Employees" }));
    await waitFor(() => {
      expect(screen.getByText("No employees yet")).toBeInTheDocument();
    });
  });
});
