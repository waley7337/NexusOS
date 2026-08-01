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

/** Entrance — long tail, no overshoot. Matches --ease-out-expo in globals.css. */
export const transitionReveal: Transition = { duration: 0.7, ease: [0.16, 1, 0.3, 1] };

/** Content appearing (page sections, cards mounting). */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: transitionReveal },
};

/**
 * Reduced-motion counterpart to fadeInUp: opacity only, no rise and no blur.
 * Selected by useRevealVariants — MotionConfig's reducedMotion="user" drops
 * the transform for us but leaves `filter` animating, and a blur sweep is
 * precisely what that preference is asking us not to play.
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
