/**
 * EmptyState (reconstructed, V2) — intentionally unused operational space.
 *
 * WHY THIS WAS THE FIRST THING REBUILT
 * Nine of eleven NexusOS modules are deliberately non-operational. The
 * empty surface is therefore not an edge case, it is the product's most
 * common screen — and it was the single most generic element in it:
 * a dashed rounded rectangle, a circle icon chip, centred text and a
 * button. That is component-library language, and it reads as
 * "this component is unfinished" rather than "nothing is here yet."
 *
 * THE DISTINCTION THE DESIGN HAS TO CARRY
 *   NOTHING IS HERE YET          ← deliberate, measured, operational
 *   THIS COMPONENT IS UNFINISHED ← accidental, apologetic
 * Everything below serves the first reading.
 *
 * HOW
 *   - LEFT-ALIGNED. Centring is what makes an empty region look like a
 *     placeholder waiting to be filled. Left alignment against a rail
 *     reads as a prepared surface with nothing filed in it yet.
 *   - A RAIL, not a border. The region is bounded on one edge by
 *     structure and left open on the others.
 *   - REGISTRATION MARKS instead of a dashed outline. The area is
 *     measured and deliberate; a dashed box says "drop zone".
 *   - MACHINE REGISTER states the condition in the system's own voice.
 *     This is the line doing the real work — a mono status string is
 *     read as a fact reported by the system, not as apology copy.
 *   - The icon is BARE and small, at the rail, not a 40px circle chip.
 *   - Generous negative space, and no illustration, no gradient, no
 *     glow, no oversized type, no entrance animation.
 *
 * A11y and API are unchanged: same props, same heading-level control,
 * same optional action, icon still decorative.
 */
import { type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Ticks } from "./structure";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  /** Default h3 for nested empties (page already has an h1). Error pages pass h1. */
  as?: "h1" | "h2" | "h3";
  /**
   * The system's own one-line statement of the condition, in machine
   * register.
   *
   * Deliberately has NO default. The first draft defaulted to "No records",
   * which rendered on a panel about missing *metrics* — a small invented
   * fact, and this product's whole position is that it does not invent.
   * A caller that knows the real condition passes it; a caller that does
   * not says nothing rather than guessing. ("No Data" is banned by spec.)
   */
  status?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
  as: Heading = "h3",
  status,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("relative py-10 pl-5 pr-4 sm:pl-6", className)}>
      <Ticks />

      {/* The rail. Bounds the region on one edge; the other three stay
          open so the surface reads as part of the page rather than as a
          container sitting on it. */}
      <span
        aria-hidden="true"
        className="absolute bottom-6 left-0 top-6 w-px bg-rail"
      />

      <div className="flex items-center gap-2">
        <Icon className="h-(--icon-xs) w-(--icon-xs) shrink-0 text-disabled-foreground" aria-hidden="true" />
        {status && <span className="text-machine">{status}</span>}
      </div>

      <Heading className="mt-3 text-h3 text-foreground">{title}</Heading>
      <p className="mt-1.5 max-w-[52ch] text-body text-muted-foreground">{description}</p>

      {actionLabel && onAction && (
        <Button className="mt-5" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
