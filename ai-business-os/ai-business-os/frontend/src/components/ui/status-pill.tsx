/** StatusPill — dot + label for live-status chrome (Part 04, Phase 5). */
import { cn } from "@/lib/utils";

export type StatusPillVariant = "online" | "warning" | "offline";

interface StatusPillProps {
  label: string;
  variant?: StatusPillVariant;
  className?: string;
}

const DOT_CLASSES: Record<StatusPillVariant, string> = {
  online: "bg-success",
  warning: "bg-warning",
  offline: "bg-muted-foreground",
};

export function StatusPill({ label, variant = "online", className }: StatusPillProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-2xs font-medium text-muted-foreground", className)}>
      {/* Static dot. A continuous ping on the healthy state competed with
          real status changes and read as decorative glow (Phase E). Size is
          fixed so a variant change cannot reflow the row. */}
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_CLASSES[variant])} />
      </span>
      {label}
    </span>
  );
}
