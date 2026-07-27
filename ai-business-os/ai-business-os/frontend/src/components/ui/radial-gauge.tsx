/**
 * RadialGauge — N-segment radar-style gauge with a center score
 * (Part 04, Phase 7). Segment colors are meant to come from the
 * --chart-1..6 palette (Phase 1) so a gauge never collides with a
 * semantic status color.
 *
 * Accessibility: the SVG carries a concise aria-label, and a sr-only
 * element gives the full segment breakdown as text — a screen-reader
 * user gets the data without parsing the drawing.
 */
import { cn } from "@/lib/utils";

export interface GaugeSegment {
  label: string;
  value: number;
  color: string;
}

interface RadialGaugeProps {
  score: number;
  scoreLabel: string;
  segments: GaugeSegment[];
  max?: number;
  size?: number;
  className?: string;
}

export function RadialGauge({ score, scoreLabel, segments, max = 10, size = 220, className }: RadialGaugeProps) {
  const c = size / 2;
  const trackRadius = size * 0.32;
  const innerRadius = trackRadius * 0.34; // gap so spokes don't cross the center score
  const labelRadius = size * 0.44;
  const n = segments.length;

  const spokes = segments.map((seg, i) => {
    const angle = -90 + i * (360 / n);
    const rad = (angle * Math.PI) / 180;
    const ratio = Math.max(0, Math.min(1, seg.value / max));
    const length = innerRadius + ratio * (trackRadius - innerRadius);
    return {
      ...seg,
      x1: c + innerRadius * Math.cos(rad),
      y1: c + innerRadius * Math.sin(rad),
      x2: c + length * Math.cos(rad),
      y2: c + length * Math.sin(rad),
      lx: c + labelRadius * Math.cos(rad),
      ly: c + labelRadius * Math.sin(rad),
    };
  });

  const summary = segments.map((s) => `${s.label} ${s.value.toFixed(1)}`).join(", ");

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${scoreLabel} score ${score.toFixed(1)} out of ${max}`}
      >
        <circle cx={c} cy={c} r={trackRadius} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />

        {spokes.map((s) => (
          <line
            key={s.label}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}

        {spokes.map((s) => (
          <text
            key={s.label}
            x={s.lx}
            y={s.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: "hsl(var(--muted-foreground))", fontSize: size * 0.045, letterSpacing: "0.04em" }}
          >
            {s.label.toUpperCase()}
          </text>
        ))}

        <text
          x={c}
          y={c - size * 0.02}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "hsl(var(--foreground))", fontSize: size * 0.16, fontWeight: 600 }}
        >
          {score.toFixed(1)}
        </text>
        <text
          x={c}
          y={c + size * 0.12}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: "hsl(var(--muted-foreground))", fontSize: size * 0.045, letterSpacing: "0.06em" }}
        >
          {scoreLabel.toUpperCase()}
        </text>
      </svg>

      <span className="sr-only">
        {scoreLabel} score {score.toFixed(1)} out of {max}. Breakdown: {summary}.
      </span>
    </div>
  );
}
