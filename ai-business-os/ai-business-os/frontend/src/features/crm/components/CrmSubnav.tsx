/**
 * CRM sub-navigation — Customers / Contacts only (operational resources).
 * Uses NavLinks styled like Tabs; does not expose Leads/Deals.
 */
import { NavLink } from "react-router-dom";
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
  return (
    <nav
      aria-label="CRM sections"
      className="inline-flex items-center gap-1 border-b border-line-soft"
    >
      <Can permission="customers.read">
        <NavLink to={ROUTES.crmCustomers} className={linkClass} end>
          Customers
        </NavLink>
      </Can>
      <Can permission="contacts.read">
        <NavLink to={ROUTES.crmContacts} className={linkClass} end>
          Contacts
        </NavLink>
      </Can>
    </nav>
  );
}
