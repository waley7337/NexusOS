/** ProgressListItem — title + trailing %, progress bar below (Part 04, Phase 8). */
import { cn } from "@/lib/utils";
import { Progress } from "./progress";

interface ProgressListItemProps {
  title: string;
  description?: string;
  percent: number;
  className?: string;
}

export function ProgressListItem({ title, description, percent, className }: ProgressListItemProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold">{clamped}%</span>
      </div>
      <Progress value={clamped} />
    </div>
  );
}
