/**
 * CRM sub-navigation — Customers / Contacts / Leads / Deals.
 */
import { Link, NavLink, useLocation } from "react-router-dom";
import { Can } from "@/components/can";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-fast focus-edge",
    isActive
      ? "border-primary-fill text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

export function CrmSubnav() {
  const { pathname } = useLocation();
  // /crm and /crm/customers both render CustomersPage.
  const customersActive =
    pathname === ROUTES.crm || pathname === ROUTES.crmCustomers;

  return (
    <nav
      aria-label="CRM sections"
      className="inline-flex items-center gap-1 border-b border-line-soft"
    >
      <Can permission="customers.read">
        <Link
          to={ROUTES.crmCustomers}
          className={linkClass({ isActive: customersActive })}
          aria-current={customersActive ? "page" : undefined}
        >
          Customers
        </Link>
      </Can>
      <Can permission="contacts.read">
        <NavLink to={ROUTES.crmContacts} className={linkClass} end>
          Contacts
        </NavLink>
      </Can>
      <Can permission="leads.read">
        <NavLink to={ROUTES.crmLeads} className={linkClass} end>
          Leads
        </NavLink>
      </Can>
      <Can permission="deals.read">
        <NavLink to={ROUTES.crmDeals} className={linkClass} end>
          Deals
        </NavLink>
      </Can>
    </nav>
  );
}
