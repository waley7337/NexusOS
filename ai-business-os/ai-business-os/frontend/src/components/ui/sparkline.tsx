/**
 * Sparkline — tiny trend line, no axes/tooltip (Part 04, Phase 7).
 * Plain SVG rather than Recharts: at this size (a few dozen px, embedded in
 * a grid cell) Recharts' ResponsiveContainer relies on ResizeObserver
 * timing that doesn't reliably fire on first paint inside a CSS grid,
 * rendering nothing. A hand-drawn path with viewBox scaling has no such
 * dependency and is simpler for what is fundamentally one polyline.
 */
interface SparklineProps {
  data: number[];
  /** CSS color, e.g. "hsl(var(--chart-2))". Defaults to --primary. */
  color?: string;
  className?: string;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;

export function Sparkline({ data, color = "hsl(var(--primary))", className }: SparklineProps) {
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
      <path d={areaPath} fill={color} fillOpacity={0.18} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
