import { Outlet } from "react-router-dom";
import { HR_WORKSPACE_PERMISSIONS } from "@/constants/permissions";
import { useAuthMe, useAnyPermission } from "@/hooks/usePermission";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { PageLoading } from "@/components/page-loading";

/** Gates HR workspace — any scoped Employee read permission grants entry. */
export function HrPermissionRoute() {
  const { isLoading } = useAuthMe();
  const allowed = useAnyPermission(HR_WORKSPACE_PERMISSIONS);

  if (isLoading) return <PageLoading />;
  if (!allowed) return <ForbiddenPage />;

  return <Outlet />;
}
