/** Centered card layout for login / register / password reset. */
import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary" />
          <span className="font-semibold tracking-tight">NexusOS</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
