import { NavLink, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the Finance workspace.
 * Tabs appear only when the caller holds the corresponding read permission.
 */
export function FinanceTabs() {
  const canInvoices = usePermission("invoices.read");
  const canExpenses = usePermission("expenses.read");
  const { pathname } = useLocation();

  if (!canInvoices && !canExpenses) return null;

  const invoicesActive =
    pathname === ROUTES.finance ||
    pathname.startsWith(ROUTES.financeInvoices);

  return (
    <nav
      aria-label="Finance sections"
      className="flex flex-wrap gap-1 border-b border-line-soft pb-px"
    >
      {canInvoices && (
        <NavLink
          to={ROUTES.financeInvoices}
          className={cn(
            "focus-ring rounded-t-md px-3 py-2 text-sm font-medium transition-colors duration-fast",
            invoicesActive
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Invoices
        </NavLink>
      )}
      {canExpenses && (
        <NavLink
          to={ROUTES.financeExpenses}
          className={({ isActive }) =>
            cn(
              "focus-ring rounded-t-md px-3 py-2 text-sm font-medium transition-colors duration-fast",
              isActive
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          Expenses
        </NavLink>
      )}
    </nav>
  );
}
