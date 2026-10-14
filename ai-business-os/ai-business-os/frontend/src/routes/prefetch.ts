import { ROUTES } from "@/constants/routes";

type PrefetchFn = () => void;

/** Live Finance feature chunk — must stay aligned with the static imports below. */
export const FINANCE_FEATURE_MODULE_ID = "@/features/finance" as const;

const prefetchRegistry: Partial<Record<string, PrefetchFn>> = {
  [ROUTES.home]: () => void import("@/pages/dashboard/DashboardPage"),
  [ROUTES.login]: () => void import("@/pages/auth/LoginPage"),
  [ROUTES.design]: () => void import("@/pages/design/DesignSystemPage"),
  [ROUTES.crm]: () => void import("@/pages/crm/CustomersPage"),
  [ROUTES.crmCustomers]: () => void import("@/pages/crm/CustomersPage"),
  [ROUTES.crmContacts]: () => void import("@/pages/crm/ContactsPage"),
  [ROUTES.crmLeads]: () => void import("@/pages/crm/LeadsPage"),
  [ROUTES.crmDeals]: () => void import("@/pages/crm/DealsPage"),
  [ROUTES.projects]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.tasks]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.hr]: () => void import("@/pages/hr/EmployeesPage"),
  [ROUTES.hrEmployees]: () => void import("@/pages/hr/EmployeesPage"),
  // Vite requires a string literal here; FINANCE_FEATURE_MODULE_ID documents the target.
  [ROUTES.finance]: () => void import("@/features/finance"),
  [ROUTES.financeInvoices]: () => void import("@/features/finance"),
  [ROUTES.financeExpenses]: () => void import("@/features/finance"),
  [ROUTES.inventory]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.documents]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.reports]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.assistant]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.settings]: () => void import("@/pages/placeholders/ModulePlaceholders"),
};

/** Prefetches the lazy chunk for a route path (§5.18). */
export function prefetchRoute(path: string): void {
  prefetchRegistry[path]?.();
}
