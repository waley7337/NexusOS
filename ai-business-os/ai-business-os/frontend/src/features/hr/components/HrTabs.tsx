import { NavLink, useLocation } from "react-router-dom";
import { hasAnyPermission } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuthMe } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";

export function HrTabs() {
  const { data: me } = useAuthMe();
  const permissions = me?.permissions ?? [];
  const { pathname } = useLocation();

  const canEmployees = hasAnyPermission(permissions, [
    "employees.read",
    "employees.read_self",
    "employees.read_team",
  ]);
  const canLeave = hasAnyPermission(permissions, [
    "leave_requests.read",
    "leave_requests.read_self",
    "leave_requests.read_team",
  ]);
  const canAttendance = hasAnyPermission(permissions, [
    "attendance.read",
    "attendance.read_self",
    "attendance.read_team",
  ]);

  if (!canEmployees && !canLeave && !canAttendance) return null;

  const employeesActive =
    pathname === ROUTES.hr ||
    pathname === ROUTES.hrEmployees ||
    pathname.startsWith(`${ROUTES.hrEmployees}/`);

  const linkClass = (active: boolean) =>
    cn(
      "focus-ring rounded-t-md px-3 py-2 text-sm font-medium transition-colors duration-fast",
      active
        ? "border-b-2 border-primary text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav
      aria-label="HR sections"
      className="flex flex-wrap gap-1 border-b border-line-soft pb-px"
    >
      {canEmployees && (
        <NavLink to={ROUTES.hrEmployees} className={linkClass(employeesActive)}>
          Employees
        </NavLink>
      )}
      {canLeave && (
        <NavLink
          to={ROUTES.hrLeave}
          className={({ isActive }) => linkClass(isActive)}
        >
          Leave
        </NavLink>
      )}
      {canAttendance && (
        <NavLink
          to={ROUTES.hrAttendance}
          className={({ isActive }) => linkClass(isActive)}
        >
          Attendance
        </NavLink>
      )}
    </nav>
  );
}
