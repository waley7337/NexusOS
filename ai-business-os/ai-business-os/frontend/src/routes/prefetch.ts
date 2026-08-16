import { ROUTES } from "@/constants/routes";

type PrefetchFn = () => void;

const prefetchRegistry: Partial<Record<string, PrefetchFn>> = {
  [ROUTES.home]: () => void import("@/pages/dashboard/DashboardPage"),
  [ROUTES.login]: () => void import("@/pages/auth/LoginPage"),
  [ROUTES.design]: () => void import("@/pages/design/DesignSystemPage"),
  // /crm index is eager (CrmIndexRedirect); prefetch the default landing page.
  [ROUTES.crm]: () => void import("@/pages/crm/CustomersPage"),
  [ROUTES.crmCustomers]: () => void import("@/pages/crm/CustomersPage"),
  [ROUTES.crmContacts]: () => void import("@/pages/crm/ContactsPage"),
  [ROUTES.crmLeads]: () => void import("@/pages/crm/LeadsPage"),
  [ROUTES.crmDeals]: () => void import("@/pages/crm/DealsPage"),
  [ROUTES.projects]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.tasks]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.hr]: () => void import("@/pages/placeholders/ModulePlaceholders"),
  [ROUTES.finance]: () => void import("@/pages/placeholders/ModulePlaceholders"),
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
