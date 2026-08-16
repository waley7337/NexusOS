/**
 * StatusPill — live status in instrument register (reconstructed, V2).
 *
 * The name is kept because ~6 call sites import it, but it is no longer a
 * pill: it is a state dot plus a machine-register label. `[ ● ONLINE ]` as
 * a rounded coloured capsule is the generic SaaS treatment; an instrument
 * states its condition as a fact and lets the dot carry the colour.
 *
 * Colour stays semantic and stays ONLY on the dot. The label is neutral,
 * which is what keeps a healthy shell from tinting the chrome green — and
 * it means a colour-blind user is reading the same word either way.
 * Status text is never conveyed by colour alone.
 */
import { cn } from "@/lib/utils";

export type StatusPillVariant = "online" | "warning" | "offline";

const DOT_CLASSES: Record<StatusPillVariant, string> = {
  online: "bg-success",
  warning: "bg-warning",
  offline: "bg-muted-foreground",
};

interface StatusPillProps {
  label: string;
  variant?: StatusPillVariant;
  className?: string;
}

export function StatusPill({ label, variant = "online", className }: StatusPillProps) {
  return (
    <span className={cn("text-machine inline-flex items-center gap-2", className)}>
      {/* Static dot. A continuous ping on the healthy state competed with
          real status changes and read as decorative glow (Phase E). Size is
          fixed so a variant change cannot reflow the row. */}
      <span
        className={cn("relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[variant])}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
