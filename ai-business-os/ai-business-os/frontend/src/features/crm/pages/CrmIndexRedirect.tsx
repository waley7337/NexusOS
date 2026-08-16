import { Navigate } from "react-router-dom";
import { PageLoading } from "@/components/page-loading";
import { ROUTES } from "@/constants/routes";
import { useAuthMe, usePermission } from "@/hooks/usePermission";

/**
 * /crm → first operational CRM section the user can read.
 * Prefer Customers, then Contacts, then Leads, then Deals.
 */
export function CrmIndexRedirect() {
  const { isPending } = useAuthMe();
  const canCustomers = usePermission("customers.read");
  const canContacts = usePermission("contacts.read");
  const canLeads = usePermission("leads.read");
  const canDeals = usePermission("deals.read");

  if (isPending) return <PageLoading />;
  if (canCustomers) return <Navigate to={ROUTES.crmCustomers} replace />;
  if (canContacts) return <Navigate to={ROUTES.crmContacts} replace />;
  if (canLeads) return <Navigate to={ROUTES.crmLeads} replace />;
  if (canDeals) return <Navigate to={ROUTES.crmDeals} replace />;
  return <Navigate to={ROUTES.home} replace />;
}
