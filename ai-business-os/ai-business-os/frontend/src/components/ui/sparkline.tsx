/**
 * Sparkline — tiny trend line, no axes/tooltip (Part 04, Phase 7).
 * Plain SVG rather than Recharts: at this size (a few dozen px, embedded in
 * a grid cell) Recharts' ResponsiveContainer relies on ResizeObserver
 * timing that doesn't reliably fire on first paint inside a CSS grid,
 * rendering nothing. A hand-drawn path with viewBox scaling has no such
 * dependency and is simpler for what is fundamentally one polyline.
 *
 * Part 04 convergence, Commit D: the flat 18% area fill becomes a gradient
 * that falls to zero at the baseline, and the line draws itself in on mount
 * (stroke-dasharray/dashoffset + the `draw` keyframe). The gradient is what
 * stops six sparklines in a row reading as six coloured blocks; the draw is
 * what makes a KPI card feel like it is reporting rather than just existing.
 * Under prefers-reduced-motion the stroke simply arrives complete.
 */
import { useId } from "react";

interface SparklineProps {
  data: number[];
  /** CSS color, e.g. "hsl(var(--chart-2))". Defaults to --primary. */
  color?: string;
  className?: string;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;

export function Sparkline({ data, color = "hsl(var(--primary))", className }: SparklineProps) {
  // useId must run unconditionally — hooks cannot sit behind the early return.
  const gradientId = useId().replace(/:/g, "");

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * VIEW_WIDTH;
    const y = VIEW_HEIGHT - ((value - min) / range) * VIEW_HEIGHT;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${VIEW_WIDTH},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        // data-draw: the prefers-reduced-motion rule in globals.css pins
        // these to stroke-dashoffset 0 so the line is simply already drawn.
        data-draw=""
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        // pathLength normalises the dash maths to 100 regardless of the
        // path's real length, so every sparkline draws over the same duration.
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100}
        style={{ animation: "draw 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        // preserveAspectRatio="none" scales x and y independently, which would
        // otherwise distort the stroke width; vector-effect keeps it honest.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
