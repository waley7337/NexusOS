/**
 * Signature login -> workspace transition (V7).
 *
 * Presentational AuthLayout -> AppLayout bridge.
 *
 * Mounted above RouterProvider. Authentication, navigation, prefetch, and
 * authorization do not read this component. pointer-events: none; aria-hidden.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

/** Visual sequence length. Not a navigation delay. */
export const AUTH_ENTRY_DURATION_MS = 820;
/** Defensive escape hatch if animationend never fires. */
export const AUTH_ENTRY_FAILSAFE_MS = 1800;

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
      className={cn("auth-entry-overlay", reducedMotion && "auth-entry-overlay--reduce")}
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        ["--auth-entry-duration" as string]: `${AUTH_ENTRY_DURATION_MS}ms`,
      }}
    >
      {/* V7: the login room leaves, the seam stays. See the SIGNATURE
          TRANSITION block in globals.css — the seam sits at var(--sidebar-w),
          which is the chassis rail's own track position, so the line the user
          is watching is already the workspace rail before the workspace has
          painted. */}
      <div className="auth-entry-plane" />
      <div className="auth-entry-seam" />
      <div className="auth-entry-sweep" />
    </div>
  );
}
