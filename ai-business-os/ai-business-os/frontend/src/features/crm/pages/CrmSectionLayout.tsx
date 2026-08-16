import { Outlet } from "react-router-dom";

/**
 * CRM section layout — required parent `<Outlet />` for `/crm/*`.
 *
 * The `/crm` path-prefix must render an outlet. A path-only parent with no
 * `element` relies on React Router hoisting children into AppLayout's outlet;
 * combined with a lazy index redirect that pattern can leave the previous
 * route (Dashboard) visible after the URL has already changed to `/crm`.
 */
export function CrmSectionLayout() {
  return <Outlet />;
}
