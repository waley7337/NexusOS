/**
 * Signature login → workspace transition.
 *
 * Presentational bridge only. Mounted above RouterProvider.
 * Armed AFTER successful authentication (LoginPage). Never delays auth,
 * navigation, prefetch, or authorization.
 *
 * pointer-events: none; aria-hidden.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

/** Full cinematic sequence length. Not a navigation delay. */
export const AUTH_ENTRY_DURATION_MS = 1650;
/** Defensive escape hatch if animationend never fires. */
export const AUTH_ENTRY_FAILSAFE_MS = 2400;

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
      {/* Depth stack: atmosphere → lights → receding login → product push → seam */}
      <div className="auth-entry-atmosphere" />
      <div className="auth-entry-light auth-entry-light--cobalt" />
      <div className="auth-entry-light auth-entry-light--cyan" />
      <div className="auth-entry-plane" />
      <div className="auth-entry-login-glass" />
      <div className="auth-entry-mark">
        <img
          src="/nexusos-wordmark.png"
          alt=""
          width={180}
          height={29}
          draggable={false}
        />
      </div>
      <div className="auth-entry-product">
        <div className="auth-entry-product-shell">
          <div className="auth-entry-product-rail" />
          <div className="auth-entry-product-body">
            <div className="auth-entry-product-bar" />
            <div className="auth-entry-product-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className="auth-entry-seam" />
      <div className="auth-entry-sweep" />
      <div className="auth-entry-vignette" />
    </div>
  );
}
