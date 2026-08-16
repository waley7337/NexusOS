/**
 * Layered atmosphere.
 * variant="cinematic" — larger spatial illumination for auth entrance.
 * No grain, no animated blur, no pointer parallax (scroll/compositor safety).
 */
import { cn } from "@/lib/utils";

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
