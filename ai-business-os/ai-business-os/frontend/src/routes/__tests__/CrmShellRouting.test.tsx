import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Link,
  Route,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LazyOutlet } from "../LazyOutlet";
import { PermissionRoute } from "../PermissionRoute";
import { CrmIndexRedirect } from "@/features/crm/pages/CrmIndexRedirect";
import { CrmSectionLayout } from "@/features/crm/pages/CrmSectionLayout";
import { useAuthStore } from "@/stores/auth";
import { ROUTES } from "@/constants/routes";

const mockGetMe = vi.fn();

vi.mock("@/features/auth", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
  return {
    ...actual,
    getMe: (...args: unknown[]) => mockGetMe(...args),
  };
});

function PathProbe() {
  const { pathname } = useLocation();
  return <div data-testid="pathname">{pathname}</div>;
}

function shellRoutes(permissions: string[]) {
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

  return createRoutesFromElements(
    <Route
      element={
        <div>
          <PathProbe />
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/crm">CRM</Link>
            <Link to="/crm/customers">Customers</Link>
            <Link to="/crm/contacts">Contacts</Link>
            <Link to="/crm/leads">Leads</Link>
            <Link to="/crm/deals">Deals</Link>
          </nav>
          <main>
            <LazyOutlet />
          </main>
        </div>
      }
    >
      <Route path="/" element={<h1>DashboardPage</h1>} />
      <Route path="/crm" element={<CrmSectionLayout />}>
        <Route index element={<CrmIndexRedirect />} />
        <Route element={<PermissionRoute permission="customers.read" />}>
          <Route path="customers" element={<h1>CustomersPage</h1>} />
        </Route>
        <Route element={<PermissionRoute permission="contacts.read" />}>
          <Route path="contacts" element={<h1>ContactsPage</h1>} />
        </Route>
        <Route element={<PermissionRoute permission="leads.read" />}>
          <Route path="leads" element={<h1>LeadsPage</h1>} />
        </Route>
        <Route element={<PermissionRoute permission="deals.read" />}>
          <Route path="deals" element={<h1>DealsPage</h1>} />
        </Route>
      </Route>
    </Route>,
  );
}

function renderCrmShell(
  initialEntries: string[] = ["/"],
  permissions: string[] = [
    "customers.read",
    "contacts.read",
    "leads.read",
    "deals.read",
  ],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(shellRoutes(permissions), { initialEntries });

  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

describe("CRM shell routing regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("entering /crm cannot leave DashboardPage mounted as the route viewport", async () => {
    const user = userEvent.setup();
    const { router } = renderCrmShell();

    expect(screen.getByRole("heading", { name: "DashboardPage" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROUTES.crmCustomers);
    });
    expect(await screen.findByRole("heading", { name: "CustomersPage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent(ROUTES.crmCustomers);
  });

  it("refresh of /crm redirects into the CRM workspace", async () => {
    renderCrmShell([ROUTES.crm]);
    expect(await screen.findByRole("heading", { name: "CustomersPage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
  });

  it("direct navigation and refresh work for each CRM section", async () => {
    for (const [path, title] of [
      [ROUTES.crmCustomers, "CustomersPage"],
      [ROUTES.crmContacts, "ContactsPage"],
      [ROUTES.crmLeads, "LeadsPage"],
      [ROUTES.crmDeals, "DealsPage"],
    ] as const) {
      const { unmount, router } = renderCrmShell([path]);
      expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("back/forward navigation swaps CRM pages without remounting Dashboard", async () => {
    const user = userEvent.setup();
    const { router } = renderCrmShell([ROUTES.crmCustomers]);

    expect(await screen.findByRole("heading", { name: "CustomersPage" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Leads" }));
    expect(await screen.findByRole("heading", { name: "LeadsPage" })).toBeInTheDocument();

    router.navigate(-1);
    expect(await screen.findByRole("heading", { name: "CustomersPage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();

    router.navigate(1);
    expect(await screen.findByRole("heading", { name: "LeadsPage" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
  });

  it("gates CRM sections by permission without falling back to Dashboard at /crm/*", async () => {
    renderCrmShell([ROUTES.crmCustomers], ["contacts.read"]);
    expect(
      await screen.findByText(/don't have permission to view this page/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "CustomersPage" })).not.toBeInTheDocument();
  });

  it("redirects /crm to home when the user has no CRM read permissions", async () => {
    const { router } = renderCrmShell([ROUTES.crm], []);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROUTES.home);
    });
    expect(await screen.findByRole("heading", { name: "DashboardPage" })).toBeInTheDocument();
  });
});
