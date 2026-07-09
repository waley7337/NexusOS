import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/auth";

/** Redirects guests to login, preserving the intended URL for post-login redirect. */
export function ProtectedRoute() {
  const authed = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();

  if (!authed) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
