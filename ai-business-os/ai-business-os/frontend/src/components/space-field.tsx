/**
 * SpaceField — the spatial environment, mounted once, outside the router.
 *
 * WHAT THIS REPLACES, AND WHY
 * The previous cinematic flew the camera into a PLACEHOLDER of the product:
 * a proxy dashboard stood next to the login form, and on sign-in that same
 * proxy scaled from ~60% to full-bleed while the real AppLayout waited
 * behind it. So the first "application" a user ever saw was a fake one, and
 * the last frame of the cinematic was a hard swap from the fake shell to
 * the real one. Both are gone. There is no product-shaped object anywhere
 * in the auth experience now — the environment IS the cinematic, and the
 * first product interface the user sees is the real one.
 *
 * WHY IT LIVES OUTSIDE THE ROUTER
 * The route changes in the middle of the sequence: AuthLayout unmounts and
 * AppLayout mounts. Anything rendered inside a route would be destroyed at
 * that moment, and a starfield that is destroyed and recreated reseeds —
 * a visible cut at precisely the frame the user is watching. Mounted here,
 * beside RouterProvider, the same canvas survives the whole sequence and
 * the only thing that changes is how fast its camera is moving.
 *
 * STACKING
 *   stage="idle"    z-index 0  — behind the sign-in surface
 *   stage="travel"  z-index 60 — above the application, which is mounting
 *                                underneath at opacity 0
 * The lift happens at CINEMATIC_ELEVATE_MS, not at arm time: before that
 * the sign-in card is still on screen and still receding, and lifting early
 * would bury it. That is one `setState` in the whole cinematic.
 *
 * PERFORMANCE
 * Every layer here animates transform and opacity only. No filter, no
 * backdrop-filter, no animated box-shadow, no layout properties. The stars
 * are one canvas (see Starfield); the light volumes are three static
 * gradients that translate and scale. Total animated elements: five.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import { Starfield } from "@/components/starfield";
import {
  CINEMATIC_ELEVATE_MS,
  CINEMATIC_FAILSAFE_MS,
  CINEMATIC_REDUCED_MS,
  CINEMATIC_TOTAL_MS,
  prefersReducedMotion,
} from "@/lib/auth-cinematic";

export function SpaceField() {
  const stage = useUiStore((s) => s.spaceStage);
  const clearAuthEntry = useUiStore((s) => s.clearAuthEntry);
  const [lifted, setLifted] = useState(false);
  const reduced = prefersReducedMotion();

  const travelling = stage === "travel";
  /**
   * With reduced motion there is no card exit to protect, so there is
   * nothing to wait for — the lift is immediate and derived rather than
   * scheduled. This is the whole cinematic's only piece of component state.
   */
  const elevated = lifted || (reduced && travelling);

  /** Lift above the application once the login route has gone. */
  useEffect(() => {
    if (!travelling || reduced) return undefined;
    const id = window.setTimeout(() => setLifted(true), CINEMATIC_ELEVATE_MS);
    return () => {
      window.clearTimeout(id);
      setLifted(false);
    };
  }, [travelling, reduced]);

  /**
   * Settle. Timer rather than animationend: the sequence is carried by
   * several sibling layers with different durations, so "the cinematic is
   * over" is a property of the timeline, not of any one element. The
   * failsafe covers a backgrounded tab, where rAF and animations stall but
   * timers still fire.
   */
  useEffect(() => {
    if (!travelling) return undefined;
    const total = reduced ? CINEMATIC_REDUCED_MS : CINEMATIC_TOTAL_MS;
    const end = window.setTimeout(clearAuthEntry, total);
    const failsafe = window.setTimeout(clearAuthEntry, CINEMATIC_FAILSAFE_MS);
    return () => {
      window.clearTimeout(end);
      window.clearTimeout(failsafe);
    };
  }, [travelling, reduced, clearAuthEntry]);

  if (stage === "off") return null;

  return (
    <div
      data-testid="space-field"
      data-space-stage={stage}
      data-elevated={elevated ? "true" : "false"}
      data-motion={reduced ? "reduce" : "full"}
      className={cn("space-field", reduced && "space-field--reduce")}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {/* Opaque ground. On the sign-in route this is simply the page's
          background; during travel it is what keeps the mounting shell out
          of sight until the reveal, and it dissolves as the shell resolves. */}
      <div className="space-base" />

      <Starfield className="space-stars" />

      {/* Three light volumes, well outside the frame. Offscreen sources,
          not blobs on the page: during travel they widen and drift, which
          is what gives the darkness a sense of scale. */}
      <div className="space-lights">
        <span className="space-light space-light--cobalt" />
        <span className="space-light space-light--cyan" />
        <span className="space-light space-light--violet" />
      </div>

      <span className="space-vignette" />
    </div>
  );
}
