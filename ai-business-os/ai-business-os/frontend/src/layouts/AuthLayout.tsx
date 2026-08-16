/**
 * AuthLayout — the first room of NexusOS (rebuilt, V6).
 *
 * The point of this phase is continuity: login and the workspace must read
 * as one environment, not two products that happen to share a logo. So the
 * auth page is built on the SAME three-track geometry as the chassis —
 * [--sidebar-w] [1px] [1fr] — with identity where navigation lives, the
 * structural seam where the rail lives, and the authentication surface
 * where the workspace lives.
 *
 * That is not a visual rhyme, it is the mechanism V7 uses: the seam and the
 * rail are the same object at the same coordinate in two states, so the
 * login→workspace transition can carry one through to the other rather than
 * cross-fading between unrelated screens.
 *
 * Below lg the grid collapses to a single centred column — a phone gets the
 * form, not a miniature of the desktop composition.
 *
 * Renders on the forced-dark auth shell regardless of the viewer's theme
 * (see .dark.auth-shell). Auth semantics are untouched: this file renders
 * no form, no field and no submit path.
 */
import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="dark auth-shell auth-page">
      {/* ---- environment ---- */}
      <div className="auth-rules pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="auth-key-light pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="auth-frame">
        {/* ---- identity · sits where navigation sits ---- */}
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
            <p className="text-machine">Business operating system</p>
          </div>

          {/* Machine register, and every line of it is true: this is the
              workspace sign-in route. Nothing here asserts a security
              property the client cannot actually observe. */}
          <p className="text-machine hidden lg:block">Workspace access</p>
        </div>

        {/* ---- THE SEAM ----
            One structural line, the same token and width as the workspace
            rail, at the same track position. Desktop only, exactly like the
            rail it becomes. */}
        <span className="auth-seam hidden lg:block" aria-hidden="true" />

        {/* ---- the authentication surface ---- */}
        <div className="flex items-center justify-center px-4 py-8 lg:px-12">
          <div className="auth-surface">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
