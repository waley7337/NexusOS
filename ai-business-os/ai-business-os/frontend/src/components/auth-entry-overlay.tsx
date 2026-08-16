/**
 * Auth → product immersion — CONTINUATION of the pre-login cinematic world.
 *
 * Not a splash. Not a logo intro. The product already existed on the
 * sign-in stage; this overlay continues the camera approach until the
 * proxy aligns with real AppLayout, then unmounts.
 *
 * Presentational only. Armed AFTER successful authentication.
 * Never delays auth, navigation, prefetch, or authorization.
 * pointer-events: none; aria-hidden.
 *
 * Transform + opacity only. FLIP origin is captured in armAuthEntry()
 * while AuthLayout is still mounted (before navigate unmounts it).
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import { NexusProductProxy } from "@/components/nexus-product-proxy";

/** Immersion band — product approach + lock. */
export const AUTH_ENTRY_DURATION_MS = 1550;
/** Failsafe if animationend never fires. */
export const AUTH_ENTRY_FAILSAFE_MS = 2000;

export function AuthEntryOverlay() {
  const active = useUiStore((s) => s.isAuthEntryActive);
  const origin = useUiStore((s) => s.immersionOrigin);
  const clearAuthEntry = useUiStore((s) => s.clearAuthEntry);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ref = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!active || reducedMotion || !origin) return;
    const root = ref.current;
    const product = productRef.current;
    if (!root || !product) return;

    const camera = root.querySelector(".auth-immersion-camera");
    if (!(camera instanceof HTMLElement)) return;

    const cr = camera.getBoundingClientRect();
    if (cr.width < 8) return;

    const scale = Math.min(origin.width / cr.width, origin.height / cr.height);
    const dx = origin.left + origin.width / 2 - (cr.left + cr.width / 2);
    const dy = origin.top + origin.height / 2 - (cr.top + cr.height / 2);

    product.style.setProperty("--immersion-from-x", `${dx}px`);
    product.style.setProperty("--immersion-from-y", `${dy}px`);
    product.style.setProperty(
      "--immersion-from-scale",
      String(Math.max(0.42, Math.min(scale, 0.92))),
    );
  }, [active, reducedMotion, origin]);

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
        "auth-immersion",
        reducedMotion && "auth-immersion--reduce",
      )}
      aria-hidden="true"
      style={{
        pointerEvents: "none",
        ["--auth-entry-duration" as string]: `${AUTH_ENTRY_DURATION_MS}ms`,
      }}
    >
      <div className="auth-immersion-field" />
      <div className="auth-immersion-light" />
      <div className="auth-immersion-light-edge" />

      <div className="auth-immersion-camera">
        <div ref={productRef} className="auth-immersion-product">
          <NexusProductProxy />
        </div>
      </div>
    </div>
  );
}
