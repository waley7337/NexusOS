/**
 * Dashboard widgets. Each widget owns its skeleton so the page composes
 * loading states for free — no spinners anywhere, per the UX spec.
 */
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import type {
  ActivityItem, AiInsight, Kpi, Meeting, PipelineStage, RevenuePoint,
} from "../types";

/* ----------------------------- KPI cards ------------------------------ */
// Cycles the Phase 1 chart palette across KPI positions so each card's icon
// chip/sparkline gets a distinct, consistent accent (Part 04, Phase 7).
const CHART_ACCENTS = [
  { icon: "bg-chart-1/15 text-chart-1", trend: "hsl(var(--chart-1))" },
  { icon: "bg-chart-2/15 text-chart-2", trend: "hsl(var(--chart-2))" },
  { icon: "bg-chart-3/15 text-chart-3", trend: "hsl(var(--chart-3))" },
  { icon: "bg-chart-4/15 text-chart-4", trend: "hsl(var(--chart-4))" },
  { icon: "bg-chart-5/15 text-chart-5", trend: "hsl(var(--chart-5))" },
  { icon: "bg-chart-6/15 text-chart-6", trend: "hsl(var(--chart-6))" },
];

export function KpiGrid({ kpis }: { kpis?: Kpi[] }) {
  if (!kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-7 w-20" /></CardContent></Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi, i) => {
        const accent = CHART_ACCENTS[i % CHART_ACCENTS.length];
        return (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            icon={kpi.icon}
            iconClassName={kpi.icon ? accent.icon : undefined}
            trend={kpi.trend}
            trendColor={accent.trend}
          />
        );
      })}
    </div>
  );
}

/* --------------------------- Chart chrome ----------------------------- */
// Shared Recharts styling (Part 04 convergence, Commit D). The charts
// previously shipped near-default library styling: 12px sans ticks, a
// dashed grid at full --border strength on both axes' worth of lines, and
// an 8px-radius tooltip on a flat card. Pulling the chrome into constants
// keeps every chart on one visual system and makes it obvious when one
// deviates.
const AXIS_TICK = {
  fontSize: 11,
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fill: "hsl(var(--muted-foreground))",
} as const;

const GRID_STROKE = "hsl(var(--foreground) / 0.06)";

const TOOLTIP_STYLE = {
  background: "hsl(var(--surface-3))",
  border: "1px solid var(--line)",
  borderRadius: 12,
  boxShadow: "var(--shadow-dropdown)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

const TOOLTIP_LABEL_STYLE = {
  color: "hsl(var(--muted-foreground))",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 4,
} as const;

const TOOLTIP_ITEM_STYLE = {
  color: "hsl(var(--foreground))",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
} as const;

/** dataKey → human label, so tooltips name their series. */
const SERIES_LABELS: Record<string, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
};

/* --------------------------- Revenue chart ---------------------------- */
export function RevenueChart({ data }: { data?: RevenuePoint[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-4">
        <SectionHeader title="Revenue vs expenses" subtitle="Trailing 7 months" tone="info" />
        <Badge variant="success">+18% YTD</Badge>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {!data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {/* No negative left margin: pulling the plot area left clipped the
                first glyph of every Y tick ("$140k" lost its "$"). */}
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Horizontal rules only, at 6% — a full grid competes with the
                  series it is meant to support. */}
              <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_TICK} dy={4} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v) => `$${v}k`} width={46} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--foreground) / 0.15)", strokeWidth: 1 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                // Returning a single-element array drops the series name, so
                // the tooltip read as two bare figures with no way to tell
                // revenue from expenses. Name the series and capitalise it.
                formatter={(v: number, name: string) => [`$${v}k`, SERIES_LABELS[name] ?? name]}
              />
              {/* Revenue on chart-1 (sky), expenses as a muted dashed
                  reference — the two used to be primary + muted, which put the
                  brand colour on a data series. */}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#rev)"
                animationDuration={900}
                animationEasing="ease-out"
                activeDot={{ r: 3.5, strokeWidth: 0, fill: "hsl(var(--chart-1))" }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--muted-foreground) / 0.7)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="transparent"
                animationDuration={900}
                animationEasing="ease-out"
                activeDot={{ r: 3, strokeWidth: 0, fill: "hsl(var(--muted-foreground))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Sales pipeline --------------------------- */
export function PipelineChart({ data }: { data?: PipelineStage[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <SectionHeader title="Sales pipeline" subtitle="By stage" tone="primary" />
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {!data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} tick={AXIS_TICK} width={82} />
              <Tooltip
                cursor={{ fill: "hsl(var(--foreground) / 0.04)" }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(v: number, _n, item) => [`${item.payload.count} deals · $${v}k`]}
              />
              {/* A funnel is one measure across ordered stages, so it reads as
                  a single sequence rather than six categories: one hue,
                  stepping down in opacity as the stage narrows. Uniform
                  full-strength primary bars made every stage look equal. */}
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16} animationDuration={800} animationEasing="ease-out">
                {data.map((stage, i) => (
                  <Cell
                    key={stage.stage}
                    fill="hsl(var(--primary))"
                    fillOpacity={1 - i * (0.55 / Math.max(1, data.length - 1))}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Recent activity -------------------------- */
export function ActivityFeed({ items }: { items?: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <SectionHeader title="Recent activity" subtitle="Across every module" tone="success" />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!items
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))
          : items.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {a.actor.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{a.actor}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- AI insights ---------------------------- */
export function AiInsights({ insights }: { insights?: AiInsight[] }) {
  const variant = { info: "info", warning: "warning", success: "success" } as const;
  return (
    <Card>
      <CardHeader className="pb-4">
        <SectionHeader
          title="AI insights"
          subtitle="Generated from this week's activity"
          tone="primary"
          action={<Button variant="outline" size="sm">Review</Button>}
          className="flex-1"
        />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {!insights
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
          : insights.map((ins) => (
              <div key={ins.id} className="flex items-start gap-2 text-sm">
                <Badge variant={variant[ins.severity]} className="mt-0.5 shrink-0">⚡</Badge>
                <p>{ins.text}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Upcoming meetings ------------------------ */
export function UpcomingMeetings({ meetings }: { meetings?: Meeting[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <SectionHeader title="Upcoming meetings" subtitle="Next three" tone="warning" />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {!meetings
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : meetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.time}</p>
                </div>
                <Badge>{m.attendees} people</Badge>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
