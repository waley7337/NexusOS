/**
 * Auth → workspace cinematic: one timeline, one source of truth.
 *
 * Three files have to agree about this sequence — LoginPage (when it
 * navigates), SpaceField (the environment and the settle) and AppLayout
 * (when the real shell resolves). They used to agree by coincidence, via
 * numbers typed into each of them. They now agree by import.
 *
 * THE SEQUENCE — total 1500ms
 *
 *   0ms     Authentication has already succeeded. Tokens are stored. The
 *           cinematic is armed. Nothing about auth waits on any of this.
 *   0-380   The sign-in surface recedes and the space darkens around it.
 *           The login route is STILL MOUNTED here — that is the whole
 *           reason the navigate is deferred: a card cannot recede after
 *           its route has unmounted, it can only vanish.
 *   380     Navigate. AuthLayout unmounts (already invisible), AppLayout
 *           mounts underneath at opacity 0, and the space rises above it.
 *   380-980 Camera travel. Star velocity ramps, parallax opens up, the
 *           light volumes deepen. Nothing product-shaped is on screen.
 *   980-1440 The REAL shell resolves: opacity 0→1, scale 1.015→1,
 *           translateY 6px→0, while the space dissolves around it.
 *   1500    Cinematic clears. The application is interactive — it has in
 *           fact been interactive since 980; the fade is presentational.
 *
 * Under prefers-reduced-motion the whole thing collapses to a short
 * cross-fade with no travel and no deferred navigate.
 */

/** How long the sign-in surface has to recede before the route changes. */
export const CINEMATIC_CARD_EXIT_MS = 380;

/**
 * When the space layer rises above the application.
 *
 * Slightly BEFORE the navigate, not equal to it. The lift is a React state
 * change and the navigate is a router commit; scheduling both at the same
 * instant leaves a measurable window where the shell has mounted but the
 * space has not yet risen over it. 60ms of margin closes that window, and
 * it costs nothing visually because the sign-in surface finishes fading at
 * 260ms — by 320ms there is nothing left underneath to bury.
 */
export const CINEMATIC_ELEVATE_MS = 320;

/** When the real shell starts resolving out of the dark. */
export const CINEMATIC_REVEAL_DELAY_MS = 980;
/** How long the real shell takes to fully resolve. */
export const CINEMATIC_REVEAL_MS = 460;

/** Full cinematic length. */
export const CINEMATIC_TOTAL_MS = 1500;

/** Escape hatch if animationend never fires (background tab, etc.). */
export const CINEMATIC_FAILSAFE_MS = 2200;

/** Reduced-motion cross-fade length. No travel, no deferred navigate. */
export const CINEMATIC_REDUCED_MS = 220;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
