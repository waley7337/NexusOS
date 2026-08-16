/**
 * AuthLayout — entrance room of NexusOS.
 *
 * Same three-track geometry as the chassis so the login→workspace seam
 * can survive into the rail. Forced-dark auth shell. No form logic here.
 */
import { Outlet } from "react-router-dom";
import { Atmosphere } from "@/components/atmosphere";

export function AuthLayout() {
  return (
    <div className="dark auth-shell auth-page">
      <Atmosphere />
      <div className="auth-rules pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
      <div className="auth-key-light pointer-events-none absolute inset-0 z-0" aria-hidden="true" />

      <div className="auth-frame">
        <div className="auth-identity lg:justify-between lg:px-6 lg:py-6">
          <div className="flex flex-col gap-3 lg:gap-4">
            <img
              className="nexusos-wordmark-img nexusos-wordmark-img--lg"
              src="/nexusos-wordmark.png"
              alt="NexusOS"
              width={224}
              height={36}
              draggable={false}
            />
            <p className="text-sm text-muted-foreground">Business operating system</p>
          </div>

          <p className="hidden text-sm text-muted-foreground lg:block">Workspace access</p>
        </div>

        <span className="auth-seam hidden lg:block" aria-hidden="true" />

        <div className="flex items-center justify-center px-4 py-8 lg:px-12">
          <div className="auth-surface">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
