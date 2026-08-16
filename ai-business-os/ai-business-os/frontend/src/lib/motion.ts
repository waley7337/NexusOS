/**
 * Motion presets — NexusOS motion language.
 *
 * Bands (match globals.css --motion-*):
 *   MICRO       120–180ms   press, icon, hover settle
 *   NAVIGATION  220–320ms   route content, tabs, nav indicator
 *   SURFACE     300–450ms   panels, shell settle
 *   SECTION     450–700ms   section reveal
 *   CINEMATIC   1400–1650ms auth immersion only
 *
 * Easings: standard / cinematic / exit — see --ease-* tokens.
 * Reduced motion: MotionConfig reducedMotion="user" in App.tsx.
 */
import type { Transition, Variants } from "framer-motion";

/** Interaction feedback — state changes the user is waiting on. */
export const transition: Transition = { duration: 0.2, ease: [0.22, 0.61, 0.36, 1] };
export const transitionFast: Transition = { duration: 0.15, ease: [0.22, 0.61, 0.36, 1] };

export const transitionInstant: Transition = { duration: 0.1, ease: [0.25, 1, 0.5, 1] };
/** NAVIGATION band — route content stage. */
export const transitionStandard: Transition = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] };
export const transitionSpatial: Transition = { duration: 0.34, ease: [0.83, 0, 0.17, 1] };
export const transitionReveal: Transition = { duration: 0.56, ease: [0.16, 1, 0.3, 1] };
export const transitionCinematic: Transition = { duration: 1.55, ease: [0.16, 1, 0.3, 1] };

/** Content appearing (design-system demos). No continuous blur in product. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transitionReveal },
};

export const fadeInPlain: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

export const staggerSection: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.06, staggerChildren: 0.08 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transitionFast },
  exit: { opacity: 0, scale: 0.97, transition: transitionFast },
};

/**
 * Authenticated route-content transition.
 * LazyOutlet plays CSS `.route-enter` (~240ms opacity + 6px rise).
 * Shell stays put. Keyed remount cancels prior enter (no queue).
 */
export const routePageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } },
};

export const routePageTransitionReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitionInstant },
};
