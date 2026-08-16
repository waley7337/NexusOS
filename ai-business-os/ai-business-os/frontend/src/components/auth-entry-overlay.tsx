/**
 * NexusOS spatial boot sequence — login success → product.
 *
 * Presentational only. Armed AFTER successful authentication.
 * Never delays auth, navigation, prefetch, or authorization.
 * pointer-events: none; aria-hidden.
 *
 * Storyboard (~1600ms): darkness → light → logo hero → depth travel →
 * product proxy approaches → locks onto real AppLayout → overlay unmounts.
 *
 * Transform + opacity only. No filters, backdrop-filter, blur, particles.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

/** Full cinematic band. Not a navigation delay. */
export const AUTH_ENTRY_DURATION_MS = 1600;
/** Failsafe if animationend never fires. */
export const AUTH_ENTRY_FAILSAFE_MS = 2100;

export function AuthEntryOverlay() {
  const active = useUiStore((s) => s.isAuthEntryActive);
  const clearAuthEntry = useUiStore((s) => s.clearAuthEntry);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearAuthEntry();
    };

    const onEnd = (event: AnimationEvent) => {
      if (event.target !== el) return;
      settle();
    };

    el?.addEventListener("animationend", onEnd);
    const id = window.setTimeout(settle, AUTH_ENTRY_FAILSAFE_MS);
    return () => {
      el?.removeEventListener("animationend", onEnd);
      window.clearTimeout(id);
    };
  }, [active, clearAuthEntry]);

  if (!active) return null;

  return (
    <div
      ref={ref}
      data-testid="auth-entry-overlay"
      data-auth-entry=""
      data-motion={reducedMotion ? "reduce" : "full"}
      className={cn(
        "auth-entry-overlay",
        reducedMotion && "auth-entry-overlay--reduce",
      )}
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        ["--auth-entry-duration" as string]: `${AUTH_ENTRY_DURATION_MS}ms`,
      }}
    >
      {/* Shot 01 — absolute darkness / persistent void */}
      <div className="auth-entry-field" />

      {/* Shot 02 — light in space (static gradients, animated opacity/scale) */}
      <div className="auth-entry-light" />
      <div className="auth-entry-light-edge" />

      {/* Camera stage — forward travel via transform */}
      <div className="auth-entry-camera">
        {/* Shot 04 — two architectural depth planes */}
        <span className="auth-entry-plane auth-entry-plane--a" />
        <span className="auth-entry-plane auth-entry-plane--b" />

        {/* Shot 03 — Nexus identity (real assets) */}
        <div className="auth-entry-identity">
          <div className="auth-entry-mark">
            <img
              className="auth-entry-mark-plate"
              src="/nexusos-logo.png"
              alt=""
              width={96}
              height={96}
              draggable={false}
            />
            <img
              className="auth-entry-symbol"
              src="/nexusos-logo.png"
              alt=""
              width={96}
              height={96}
              draggable={false}
            />
          </div>
          <img
            className="auth-entry-wordmark"
            src="/nexusos-wordmark.png"
            alt=""
            width={220}
            height={36}
            draggable={false}
          />
        </div>

        {/* Shot 05–06 — product proxy matching real shell chrome silhouette */}
        <div className="auth-entry-shell">
          <div className="auth-entry-shell-chrome">
            <div className="auth-entry-shell-rail">
              <span className="auth-entry-shell-brand" />
              <span className="auth-entry-shell-nav" />
              <span className="auth-entry-shell-nav" />
              <span className="auth-entry-shell-nav auth-entry-shell-nav--short" />
            </div>
            <div className="auth-entry-shell-body">
              <div className="auth-entry-shell-bar">
                <span className="auth-entry-shell-search" />
                <span className="auth-entry-shell-actions" />
              </div>
              <div className="auth-entry-shell-stage">
                <span className="auth-entry-shell-signals" />
                <span className="auth-entry-shell-panel" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
