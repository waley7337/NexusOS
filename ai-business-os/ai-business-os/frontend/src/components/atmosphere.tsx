/**
 * Atmosphere — the application shell's ambient depth.
 *
 * Scope note: this used to carry a "cinematic" variant and the starfield
 * for the auth world. Both moved to SpaceField, which lives outside the
 * router because it has to survive the auth→workspace navigation. What is
 * left here is only what the signed-in shell uses.
 *
 * No grain, no animated blur, no pointer parallax (scroll/compositor safety).
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
    </div>
  );
}
