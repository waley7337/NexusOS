import type { ReactNode } from "react";
import type { Permission } from "@/constants/permissions";
import { usePermission } from "@/hooks/usePermission";

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Conditionally renders children when the user holds `permission`. */
export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = usePermission(permission);
  return allowed ? children : fallback;
}
