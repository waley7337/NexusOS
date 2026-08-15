/**
 * Motion presets — §4.23.
 * Every animation communicates state (enter, exit, reorder). No decorative
 * animation. Use these presets, don't invent timings.
 *
 * Part 04 convergence, Commit E: entrances moved from a 200ms opacity + 8px
 * nudge to a 700ms blur-to-focus reveal on the expo-out curve. The blur is
 * what makes an entrance read as "resolving into place" rather than "fading
 * in", and the longer tail is what separates a designed reveal from a plain
 * transition. Interaction feedback (hover, press, state change) stays at
 * 150–250ms — only *entrances* got longer, because that is the one case
 * where the user is not waiting on a result.
 *
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">
 * in App.tsx: Framer Motion animates through inline styles, so the CSS
 * prefers-reduced-motion rules in globals.css cannot reach these variants.
 */
import type { Transition, Variants } from "framer-motion";

/** Interaction feedback — state changes the user is waiting on. */
export const transition: Transition = { duration: 0.2, ease: [0.2, 0, 0, 1] };
export const transitionFast: Transition = { duration: 0.15, ease: [0.2, 0, 0, 1] };

/**
 * Bands mirroring --duration-* / --ease-* in globals.css, so a component
 * animated in JS and one animated in CSS agree on what "a tab switch" costs.
 * Chosen by travel distance, not by component:
 *
 *   instant   press, checkbox, icon swap        100ms
 *   fast      hover, tooltip, small menus       150ms  (transitionFast)
 *   standard  tabs, route content, dropdown     220ms
 *   spatial   sidebar, drawer, mobile nav       340ms
 */
export const transitionInstant: Transition = { duration: 0.1, ease: [0.25, 1, 0.5, 1] };
export const transitionStandard: Transition = { duration: 0.22, ease: [0.25, 1, 0.5, 1] };
export const transitionSpatial: Transition = { duration: 0.34, ease: [0.83, 0, 0.17, 1] };

/** Entrance — long tail, no overshoot. Matches --ease-out-expo in globals.css. */
export const transitionReveal: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

/** Content appearing (page sections, cards mounting). */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: transitionReveal },
};

/**
 * Reduced-motion counterpart to fadeInUp: opacity only, no rise and no blur.
 * MotionConfig's reducedMotion="user" drops the transform but leaves
 * `filter` animating, and a blur sweep is precisely what that preference
 * is asking us not to play. Callers that still use fadeInUp (the design
 * system page) should swap to this variant when reduced motion is on.
 */
export const fadeInPlain: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

/** Lists: stagger children by 30ms so order reads as order. */
export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

/**
 * Page-level sections (hero, KPI row, chart row, activity row).
 *
 * delayChildren holds the cascade back a beat so the first section doesn't
 * start mid-paint, and 0.08 between sections is slow enough to read as a
 * sequence rather than a flicker. A handful of large chunks needs a more
 * perceptible interval than staggerChildren's list-item timing.
 */
export const staggerSection: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.06, staggerChildren: 0.08 } },
};

/** Element added/removed in place (rows, chips, toasts). */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transitionFast },
  exit: { opacity: 0, scale: 0.97, transition: transitionFast },
};

/**
 * Authenticated route-content transition (Phase C). Documented here so
 * JS motion and the CSS `.route-enter` animation in globals.css agree
 * on travel (8px) and the standard band (220ms / ease-out-quart).
 *
 * LazyOutlet plays this as CSS, not named Framer variants: a parent
 * hidden/visible context would orchestrate Dashboard's section reveals,
 * and keyed Framer remounts left the incoming page at opacity 0.
 *
 * No blur, no scale, no directional slide: MotionConfig cannot suppress
 * `filter`, and left/right paging reads as a carousel in a control plane.
 */
export const routePageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitionStandard },
};

/** Reduced-motion counterpart: opacity only, instant band, no translation. */
export const routePageTransitionReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionInstant },
};
