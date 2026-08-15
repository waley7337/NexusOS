/**
 * Centered brand shell for login / register / password reset.
 * Renders on NexusOS's jet-black auth surface (see `.dark.auth-shell`
 * in globals.css) regardless of the viewer's light/dark preference —
 * every control below (Field, Input, Button, Label) is unmodified and
 * simply reads the scoped tokens, so behavior and a11y are untouched.
 */
import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="dark auth-shell auth-page">
      <div className="auth-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="auth-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="auth-horizon pointer-events-none absolute inset-x-0 top-0 -z-10" aria-hidden="true" />

      <div className="auth-frame">
        <div className="auth-identity">
          <div className="nexusos-wordmark-lockup">
            <img
              className="nexusos-wordmark-img nexusos-wordmark-img--lg"
              src="/nexusos-wordmark.png"
              alt="NexusOS"
              width={224}
              height={36}
              draggable={false}
            />
          </div>
          <p className="auth-identity-kicker">Business operating system</p>
          <p className="auth-identity-note">Workspace access</p>
        </div>

        <div className="auth-surface">
          <Outlet />
        </div>
      </div>

      <p className="auth-footnote">NexusOS · Workspace sign-in</p>
    </div>
  );
}
