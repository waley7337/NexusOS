/**
 * Billing checkout layout — same SpatialShell / SpaceField atmosphere as login.
 */
import { Outlet } from "react-router-dom";
import { SpatialShell } from "@/layouts/SpatialShell";

export function BillingCheckoutLayout() {
  return (
    <SpatialShell density="checkout" tagline="Subscription checkout">
      <Outlet />
    </SpatialShell>
  );
}
