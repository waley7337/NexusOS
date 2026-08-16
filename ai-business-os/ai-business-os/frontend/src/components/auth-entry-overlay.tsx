/**
 * Signature login → NexusOS cinematic entry.
 *
 * Presentational only. Armed AFTER successful authentication.
 * Never delays auth, navigation, prefetch, or authorization.
 * pointer-events: none; aria-hidden.
 *
 * Lean stack (performance): field → one glow → logo → shell → fade.
 * Transform + opacity only. No animated filters / blur.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

/** Cinematic band. Not a navigation delay. */
export const AUTH_ENTRY_DURATION_MS = 1000;
/** Failsafe if animationend never fires. */
export const AUTH_ENTRY_FAILSAFE_MS = 1400;

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
      <div className="auth-entry-field" />
      <div className="auth-entry-glow" />

      <div className="auth-entry-identity">
        <img
          className="auth-entry-symbol"
          src="/nexusos-logo.png"
          alt=""
          width={56}
          height={56}
          draggable={false}
        />
        <img
          className="auth-entry-wordmark"
          src="/nexusos-wordmark.png"
          alt=""
          width={200}
          height={32}
          draggable={false}
        />
      </div>

      <div className="auth-entry-shell">
        <div className="auth-entry-shell-chrome">
          <div className="auth-entry-shell-rail" />
          <div className="auth-entry-shell-stage" />
        </div>
      </div>
    </div>
  );
}
