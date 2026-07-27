/** Card — soft borders, breathing room. The base surface of every dashboard widget. */
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "solid" (default) is the working surface for dense/data content — tables,
   * forms, lists. "glass" is opt-in, for floating/elevated surfaces only
   * (hero headers, palettes, panels) — see Design Constitution §9. */
  variant?: "solid" | "glass";
  /** Opt into the restrained hover elevation + pointer spotlight. For cards
   * that are genuinely interactive or that headline a section; a dense grid of
   * every-card-lifts reads as noise (Part 04 convergence, Commit C). */
  interactive?: boolean;
}

export function Card({ className, variant = "solid", interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        // .surface carries the whole recipe: ladder fill, translucent
        // hairline, inset top highlight and deep drop shadow. Before this the
        // Card was `rounded-xl border bg-card` and measured boxShadow: none —
        // no card in the product cast a shadow, which is the single biggest
        // reason the UI read as flat.
        variant === "glass" ? "text-card-foreground surface-glass" : "surface text-card-foreground",
        interactive && "card-lift spotlight",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-2 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
