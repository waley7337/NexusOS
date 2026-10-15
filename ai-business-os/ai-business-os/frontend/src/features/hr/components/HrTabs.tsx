import { NavLink, useLocation } from "react-router-dom";
import {
  HR_ATTENDANCE_READ_PERMISSIONS,
  HR_EMPLOYEES_READ_PERMISSIONS,
  HR_LEAVE_READ_PERMISSIONS,
  hasAnyPermission,
} from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuthMe } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";

export function HrTabs() {
  const { data: me } = useAuthMe();
  const permissions = me?.permissions ?? [];
  const { pathname } = useLocation();

  const canEmployees = hasAnyPermission(permissions, HR_EMPLOYEES_READ_PERMISSIONS);
  const canLeave = hasAnyPermission(permissions, HR_LEAVE_READ_PERMISSIONS);
  const canAttendance = hasAnyPermission(permissions, HR_ATTENDANCE_READ_PERMISSIONS);

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
