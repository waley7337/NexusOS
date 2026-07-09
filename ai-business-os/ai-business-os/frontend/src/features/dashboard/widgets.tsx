/**
 * Dashboard widgets. Each widget owns its skeleton so the page composes
 * loading states for free — no spinners anywhere, per the UX spec.
 */
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ActivityItem, AiInsight, Kpi, Meeting, PipelineStage, RevenuePoint,
} from "./types";

/* ----------------------------- KPI cards ------------------------------ */
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
      {kpis.map((kpi) => (
        <Card key={kpi.id}>
          <CardContent>
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <p className="text-2xl font-semibold tracking-tight">{kpi.value}</p>
              <DeltaPill delta={kpi.delta} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DeltaPill({ delta }: { delta: number }) {
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        delta > 0 && "text-emerald-600 dark:text-emerald-400",
        delta < 0 && "text-red-600 dark:text-red-400",
        delta === 0 && "text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(delta)}%
    </span>
  );
}

/* --------------------------- Revenue chart ---------------------------- */
export function RevenueChart({ data }: { data?: RevenuePoint[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>Revenue vs expenses</CardTitle><Badge variant="success">+18% YTD</Badge></CardHeader>
      <CardContent className="h-64">
        {!data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -16, right: 4, top: 4 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}k`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`$${v}k`]}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
              <Area type="monotone" dataKey="expenses" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
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
      <CardHeader><CardTitle>Sales pipeline</CardTitle></CardHeader>
      <CardContent className="h-64">
        {!data ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={82} />
              <Tooltip
                cursor={{ fill: "hsl(var(--secondary))" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number, _n, item) => [`${item.payload.count} deals · $${v}k`]}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={18} />
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
      <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
      <CardContent className="space-y-4">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI insights
        </CardTitle>
        <Button variant="outline" size="sm">Review</Button>
      </CardHeader>
      <CardContent className="space-y-3">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming meetings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
