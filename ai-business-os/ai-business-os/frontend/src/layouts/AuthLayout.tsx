/**
 * AuthLayout — cinematic entrance world.
 *
 * Environment + identity + sign-in surface + floating NexusOS product
 * coexist in one spatial composition BEFORE authentication.
 *
 * Product is the centered hero object (same spatial locus the immersion
 * overlay continues from), so AuthLayout unmount on navigate does not
 * create a left/right jump — the camera shot continues from center.
 */
import { Outlet } from "react-router-dom";
import { Atmosphere } from "@/components/atmosphere";
import { NexusProductProxy } from "@/components/nexus-product-proxy";
import { useUiStore } from "@/stores/ui";

export function AuthLayout() {
  const immersing = useUiStore((s) => s.isAuthEntryActive);

  return (
    <div
      className="dark auth-shell auth-page auth-cinematic"
      data-auth-stage={immersing ? "immersion" : "idle"}
    >
      <Atmosphere variant="cinematic" />

      <div className="auth-cinematic-world">
        <div className="auth-cinematic-product" data-auth-product="">
          <NexusProductProxy />
        </div>

        <div className="auth-cinematic-identity">
          <img
            className="nexusos-wordmark-img"
            src="/nexusos-wordmark.png"
            alt="NexusOS"
            width={180}
            height={28}
            draggable={false}
          />
          <p className="auth-cinematic-tagline">Business operating system</p>
        </div>

        <div className="auth-cinematic-panel">
          <div className="auth-surface">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
