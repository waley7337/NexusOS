import { Navigate } from "react-router-dom";
import { PageLoading } from "@/components/page-loading";
import { ROUTES } from "@/constants/routes";
import { useAuthMe, usePermission } from "@/hooks/usePermission";

/**
 * /crm → first operational CRM section the user can read.
 * Prefer Customers when both are available (historical default).
 */
export function CrmIndexRedirect() {
  const { isPending } = useAuthMe();
  const canCustomers = usePermission("customers.read");
  const canContacts = usePermission("contacts.read");

  if (isPending) return <PageLoading />;
  if (canCustomers) return <Navigate to={ROUTES.crmCustomers} replace />;
  if (canContacts) return <Navigate to={ROUTES.crmContacts} replace />;
  return <Navigate to={ROUTES.home} replace />;
}
