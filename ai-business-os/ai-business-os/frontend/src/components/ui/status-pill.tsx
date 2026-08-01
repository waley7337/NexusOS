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
      {/* A halo ring expanding out of the dot reads as a live signal far more
          clearly than opacity alone (Part 04 convergence, Commit C). Only the
          healthy state pulses — a degraded or offline system should sit still,
          not animate reassuringly. The halo is a separate absolutely
          positioned span so the dot itself never changes size and the row
          cannot reflow. */}
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {variant === "online" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", DOT_CLASSES[variant])} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_CLASSES[variant])} />
      </span>
      {label}
    </span>
  );
}
