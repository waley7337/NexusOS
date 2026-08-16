/**
 * Layered cinematic atmosphere.
 * Drift/parallax are CSS + parent CSS variables — no JS animation loops.
 */
import { cn } from "@/lib/utils";

export function Atmosphere({ className }: { className?: string }) {
  return (
    <div className={cn("atmosphere", className)} aria-hidden="true">
      <div className="atmosphere-parallax">
        <span className="atmosphere-layer atmosphere-layer--cobalt" />
        <span className="atmosphere-layer atmosphere-layer--cyan" />
        <span className="atmosphere-layer atmosphere-layer--violet" />
      </div>
      <span className="atmosphere-vignette" />
      <span className="atmosphere-grain" />
    </div>
  );
}
