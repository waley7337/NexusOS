/** SystemStatusBar — persistent status strip (Part 04, Phase 5). */
import { cn } from "@/lib/utils";
import { StatusPill, type StatusPillVariant } from "./status-pill";

interface SystemStatusBarProps {
  variant?: StatusPillVariant;
  label?: string;
  /** Secondary line, e.g. "Synced 2 min ago". Omitted when there's nothing to say yet. */
  detail?: string;
  className?: string;
}

export function SystemStatusBar({
  variant = "online",
  label = "All systems nominal",
  detail,
  className,
}: SystemStatusBarProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <StatusPill variant={variant} label={label} />
      {detail && <p className="pl-3 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
