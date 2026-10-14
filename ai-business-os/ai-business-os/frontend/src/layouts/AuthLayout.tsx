/**
 * AuthLayout — the first room of NexusOS.
 *
 * WHAT CHANGED
 * This route used to render a mock of the product beside the form: a
 * proxy dashboard with a fake rail, fake tiles and a fake chart. It is
 * gone. Showing a placeholder of the application to someone who has not
 * signed in yet is a promise made in fake pixels, and it also gave the
 * cinematic a fake object to fly into. Neither is wanted.
 *
 * What is left is the environment and the door: deep space, live stars,
 * the NexusOS identity, and one sign-in surface, centred. The emptiness is
 * the composition, not a gap where something should go.
 *
 * The environment itself is NOT rendered here. It is SpaceField, mounted
 * outside the router, so it survives the navigation into the workspace —
 * see that file. This layout only declares that the space should be awake
 * ("idle") while a sign-in route is on screen via SpatialShell.
 *
 * Renders on the forced-dark auth shell regardless of the viewer's theme
 * (see .dark.auth-shell). Auth semantics are untouched: this file renders
 * no form, no field and no submit path.
 */
import { Outlet } from "react-router-dom";
import { SpatialShell } from "@/layouts/SpatialShell";

export function AuthLayout() {
  return (
    <SpatialShell density="auth">
      <Outlet />
    </SpatialShell>
  );
}
