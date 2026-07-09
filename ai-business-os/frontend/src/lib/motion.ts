/**
 * Motion presets — §4.23.
 * 150–250ms, every animation communicates state (enter, exit, reorder).
 * No decorative animation. Use these presets, don't invent timings.
 */
import type { Transition, Variants } from "framer-motion";

export const transition: Transition = { duration: 0.2, ease: [0.2, 0, 0, 1] };
export const transitionFast: Transition = { duration: 0.15, ease: [0.2, 0, 0, 1] };

/** Content appearing (page sections, cards mounting). */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition },
};

/** Lists: stagger children by 30ms so order reads as order. */
export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

/** Element added/removed in place (rows, chips, toasts). */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transitionFast },
  exit: { opacity: 0, scale: 0.97, transition: transitionFast },
};
