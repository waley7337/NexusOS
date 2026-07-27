import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { useMediaQuery } from "./useMediaQuery";

/**
 * Animates a number from 0 to `target` (Part 04, Phase 8) — the LifeOS-style
 * number reveal on a stat's entrance. Reuses the existing useMediaQuery
 * hook to respect prefers-reduced-motion: Design Constitution §10 —
 * motion communicates state, it never bypasses reduced-motion. Under
 * reduced motion, the target value is returned immediately, no animation.
 */
export function useCountUp(target: number): number {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [value, setValue] = useState(prefersReducedMotion ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    // 1.1s on the expo-out curve (Part 04 convergence, Commit E). At 600ms
    // on the interaction curve the count read as a glitch rather than a
    // reveal — the number was at its final value before the eye had settled
    // on the card. Matches --duration-reveal / --ease-out-expo.
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });

    return () => controls.stop();
  }, [target, prefersReducedMotion]);

  return value;
}
