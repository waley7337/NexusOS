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
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[variant], variant === "online" && "pulse-live")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
