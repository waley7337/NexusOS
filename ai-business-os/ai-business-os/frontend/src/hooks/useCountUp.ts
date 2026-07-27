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

    const controls = animate(0, target, {
      duration: 0.6,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setValue(v),
    });

    return () => controls.stop();
  }, [target, prefersReducedMotion]);

  return value;
}
