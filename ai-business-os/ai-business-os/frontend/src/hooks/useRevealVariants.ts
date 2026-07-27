import { useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { fadeInUp, fadeInPlain, staggerSection } from "@/lib/motion";

/**
 * Picks the section-entrance variants appropriate to the user's motion
 * preference (Part 04 convergence, Commit E).
 *
 * MotionConfig reducedMotion="user" in App.tsx already drops the transform
 * (the 14px rise), but it does not touch `filter` — so the blur-to-focus pass
 * would still play for a user who asked for reduced motion. Verified in a real
 * browser: the end state was correct, but the 700ms transition still blurred.
 * A blur sweep is exactly the kind of effect that preference exists to
 * suppress, so under reduced motion the reveal collapses to a plain opacity
 * fade, which is allowed and keeps the content's arrival legible.
 */
export function useRevealVariants(): { container: Variants; item: Variants } {
  const prefersReducedMotion = useReducedMotion();

  return {
    container: staggerSection,
    item: prefersReducedMotion ? fadeInPlain : fadeInUp,
  };
}
