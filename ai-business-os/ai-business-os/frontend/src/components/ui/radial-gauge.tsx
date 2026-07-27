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
      // Glow at reduced alpha so the halo reads as light rather than as a
      // second, fatter stroke. Segment colours arrive as `hsl(var(--chart-N))`,
      // which accepts a slash-alpha; anything else is used as-is.
      glow: seg.color.startsWith("hsl(var(") ? seg.color.replace(/\)$/, " / 0.45)") : seg.color,
      x1: c + innerRadius * Math.cos(rad),
      y1: c + innerRadius * Math.sin(rad),
      x2: c + length * Math.cos(rad),
      y2: c + length * Math.sin(rad),
      // Full-length track endpoint (the spoke's maximum reach).
      tx: c + trackRadius * Math.cos(rad),
      ty: c + trackRadius * Math.sin(rad),
      lx: c + labelRadius * Math.cos(rad),
      ly: c + labelRadius * Math.sin(rad),
    };
  });

  const summary = segments.map((s) => `${s.label} ${s.value.toFixed(1)}`).join(", ");

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      {/* A soft radial bloom behind the gauge, so it reads as an instrument
          with its own light rather than a diagram drawn on the card. */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-md"
        style={{ background: "radial-gradient(circle at center, hsl(var(--primary) / 0.16), transparent 62%)" }}
        aria-hidden="true"
      />

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label={`${scoreLabel} score ${score.toFixed(1)} out of ${max}`}
      >
        {/* Concentric quartile rings give the spokes something to be read
            against — a bare outer circle gave no sense of scale. The inner
            three are dashed so they stay reference marks rather than
            competing with the data. */}
        {[0.25, 0.5, 0.75, 1].map((step, i) => (
          <circle
            key={step}
            cx={c}
            cy={c}
            r={innerRadius + step * (trackRadius - innerRadius)}
            fill="none"
            stroke="hsl(var(--foreground) / 0.05)"
            strokeWidth={1}
            strokeDasharray={i === 3 ? undefined : "2 4"}
          />
        ))}

        {/* Unfilled track behind each spoke, so a low score reads as "short
            against its range" rather than just "short". */}
        {spokes.map((s) => (
          <line
            key={`${s.label}-track`}
            data-spoke="track"
            x1={s.x1}
            y1={s.y1}
            x2={s.tx}
            y2={s.ty}
            stroke="hsl(var(--foreground) / 0.05)"
            strokeWidth={7}
            strokeLinecap="round"
          />
        ))}

        {spokes.map((s, i) => (
          <line
            key={s.label}
            data-spoke="value"
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth={7}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100}
            style={{
              // Staggered so the gauge assembles spoke by spoke and the eye
              // can follow the order, instead of everything snapping in at once.
              animation: `draw 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${200 + i * 80}ms forwards`,
              filter: `drop-shadow(0 0 6px ${s.glow})`,
            }}
          />
        ))}

        {spokes.map((s) => (
          <text
            key={s.label}
            x={s.lx}
            y={s.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fill: "hsl(var(--muted-foreground))",
              fontSize: size * 0.04,
              fontWeight: 600,
              letterSpacing: "0.08em",
            }}
          >
            {s.label.toUpperCase()}
          </text>
        ))}

        <text
          x={c}
          y={c - size * 0.02}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: "hsl(var(--foreground))",
            fontSize: size * 0.16,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {score.toFixed(1)}
        </text>
        <text
          x={c}
          y={c + size * 0.115}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: "hsl(var(--muted-foreground))",
            fontSize: size * 0.036,
            fontWeight: 600,
            letterSpacing: "0.18em",
          }}
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
