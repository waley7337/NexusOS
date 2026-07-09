import { Outlet } from "react-router-dom";
import type { Permission } from "@/constants/permissions";
import { useAuthMe, usePermission } from "@/hooks/usePermission";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { PageLoading } from "@/components/page-loading";

interface PermissionRouteProps {
  permission: Permission;
}

/** Gates a route subtree — renders 403 on denial, never masked as 404. */
export function PermissionRoute({ permission }: PermissionRouteProps) {
  const { isLoading } = useAuthMe();
  const allowed = usePermission(permission);

  if (isLoading) return <PageLoading />;
  if (!allowed) return <ForbiddenPage />;

  return <Outlet />;
}
