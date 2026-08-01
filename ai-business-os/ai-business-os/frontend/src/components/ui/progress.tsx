/** Progress bar — a sanctioned loading state (§4.16). Announces value. */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Fill from zero on mount (Part 04 convergence, Commit D) so the bar reads
  // as reporting a measurement rather than as a static rule. The width
  // transition below does the animating; this just gives it somewhere to
  // travel from. Under reduced motion it starts at the real value, so nothing
  // animates and no intermediate width is ever painted.
  const [width, setWidth] = useState(prefersReducedMotion ? clamped : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setWidth(clamped);
      return;
    }
    const frame = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped, prefersReducedMotion]);

  return (
    <div
      role="progressbar"
      // aria-valuenow reports the REAL value, never the animating one — a
      // screen reader must not narrate a fill animation.
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-4", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-expo"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
