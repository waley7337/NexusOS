/**
 * Layered atmosphere.
 * variant="cinematic" — larger spatial illumination for auth entrance, plus
 * the live starfield: the cinematic world is deep space, and a static sky
 * behind a moving camera is the one thing that gives the composition away.
 * The stars are canvas-drawn (see Starfield) precisely so that adding them
 * costs no continuous DOM animation here.
 *
 * No grain, no animated blur, no pointer parallax (scroll/compositor safety).
 */
import { cn } from "@/lib/utils";
import { Starfield } from "@/components/starfield";

export function Atmosphere({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "cinematic";
}) {
  return (
    <div
      className={cn("atmosphere", variant === "cinematic" && "atmosphere--cinematic", className)}
      aria-hidden="true"
    >
      {/* The sky sits UNDER the light volumes, not over them: the nebula
          glow is nearer than the stars, so it washes them out where it is
          strongest. That ordering is what stops the field reading as dots
          pasted on top of a gradient. */}
      {variant === "cinematic" ? <Starfield className="atmosphere-stars" /> : null}
      <div className="atmosphere-parallax">
        <span className="atmosphere-layer atmosphere-layer--cobalt" />
        <span className="atmosphere-layer atmosphere-layer--cyan" />
        <span className="atmosphere-layer atmosphere-layer--violet" />
        {variant === "cinematic" ? (
          <>
            <span className="atmosphere-layer atmosphere-layer--sweep" />
            <span className="atmosphere-layer atmosphere-layer--depth" />
          </>
        ) : null}
      </div>
      <span className="atmosphere-vignette" />
    </div>
  );
}
