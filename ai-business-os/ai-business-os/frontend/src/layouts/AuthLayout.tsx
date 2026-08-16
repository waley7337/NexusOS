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
 * ("idle") while a sign-in route is on screen, and lets it be when the
 * cinematic has taken it over.
 *
 * Renders on the forced-dark auth shell regardless of the viewer's theme
 * (see .dark.auth-shell). Auth semantics are untouched: this file renders
 * no form, no field and no submit path.
 */
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useUiStore } from "@/stores/ui";

export function AuthLayout() {
  const immersing = useUiStore((s) => s.isAuthEntryActive);

  useEffect(() => {
    const { setSpaceStage } = useUiStore.getState();
    // Only claim the space if the cinematic has not already taken it.
    if (useUiStore.getState().spaceStage !== "travel") setSpaceStage("idle");
    return () => {
      // On the way out during a sign-in, the cinematic owns the space and
      // clears it when it settles. On any other exit (back button, a
      // redirect), put it away.
      if (!useUiStore.getState().isAuthEntryActive) setSpaceStage("off");
    };
  }, []);

  return (
    <div
      className="dark auth-shell auth-page auth-world"
      data-auth-stage={immersing ? "leaving" : "idle"}
    >
      <div className="auth-column">
        <div className="auth-identity">
          <img
            className="nexusos-wordmark-img"
            src="/nexusos-wordmark.png"
            alt="NexusOS"
            width={196}
            height={30}
            draggable={false}
          />
          <p className="auth-tagline">Business operating system</p>
        </div>

        <div className="auth-panel">
          <div className="auth-surface">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
