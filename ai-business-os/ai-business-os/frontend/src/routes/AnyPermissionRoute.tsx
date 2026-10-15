import { Outlet } from "react-router-dom";
import type { Permission } from "@/constants/permissions";
import { useAuthMe, useAnyPermission } from "@/hooks/usePermission";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { PageLoading } from "@/components/page-loading";

interface AnyPermissionRouteProps {
  permissions: readonly Permission[];
}

/** Gates a route subtree when the caller holds any of the listed permissions. */
export function AnyPermissionRoute({ permissions }: AnyPermissionRouteProps) {
  const { isLoading } = useAuthMe();
  const allowed = useAnyPermission(permissions);

  if (isLoading) return <PageLoading />;
  if (!allowed) return <ForbiddenPage />;

  return <Outlet />;
}
