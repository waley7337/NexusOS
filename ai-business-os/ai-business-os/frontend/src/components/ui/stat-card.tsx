/** StatCard — icon chip, value, delta pill, optional sparkline (Part 04, Phase 7). */
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "./card";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useSpotlight } from "@/hooks/useSpotlight";

const PLAIN_INTEGER = /^\d+$/;

/**
 * Renders `value` as a count-up entrance (Part 04, Phase 8) when it's a
 * plain integer string ("23", "312") — the common case for counts. Values
 * that already carry formatting ("$128,430", "11.4mo") render statically:
 * animating a reformatted currency string mid-flight is real added
 * complexity for what the Design Constitution asks to stay a restrained,
 * legible number reveal, not a bigger data-model change.
 */
function AnimatedValue({ value }: { value: string }) {
  const isPlainInteger = PLAIN_INTEGER.test(value);
  const animated = useCountUp(isPlainInteger ? Number(value) : 0);
  if (!isPlainInteger) return <>{value}</>;
  return <>{Math.round(animated)}</>;
}

interface StatCardProps {
  label: string;
  value: string;
  /** % vs last period. Omit to hide the delta pill entirely. */
  delta?: number;
  icon?: LucideIcon;
  /** Icon chip background/text classes, e.g. "bg-chart-2/15 text-chart-2". */
  iconClassName?: string;
  /** Trend points for the inline sparkline. Omit to skip the sparkline. */
  trend?: number[];
  trendColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  iconClassName,
  trend,
  trendColor,
  className,
}: StatCardProps) {
  // A KPI card is the archetypal thing worth pointing at, so it opts into the
  // hover lift + pointer spotlight (Part 04 convergence, Commit E).
  const spotlightRef = useSpotlight<HTMLDivElement>();

  return (
    <Card ref={spotlightRef} interactive className={className}>
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                iconClassName ?? "bg-primary/10 text-primary",
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
          {delta !== undefined && <DeltaPill delta={delta} />}
        </div>

        {/* .num — tabular figures. Without it a count-up animation reflows
            the card on every frame, because proportional digits differ in
            width (Part 04 convergence, Commit B). */}
        <p className="num mt-3 font-mono text-2xl font-semibold tracking-tight">
          <AnimatedValue value={value} />
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>

        {trend && trend.length > 1 && (
          <div className="mt-2 h-10">
            <Sparkline data={trend} color={trendColor} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Same logic/markup KpiGrid's inline delta pill used before Phase 7 — moved
 * here since StatCard now owns delta-pill rendering for every consumer. */
export function DeltaPill({ delta }: { delta: number }) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        // Semantic tokens, not raw palette classes — emerald-*/red-* bypassed
        // the token system and so didn't follow the Commit A retune.
        "num inline-flex items-center gap-0.5 text-2xs font-medium",
        delta > 0 && "text-success",
        delta < 0 && "text-destructive",
        delta === 0 && "text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(delta)}%
    </span>
  );
}
