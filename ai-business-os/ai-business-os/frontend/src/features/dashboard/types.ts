import type { LucideIcon } from "lucide-react";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: number; // % vs last period
  icon?: LucideIcon;
  /** Trend points for an inline sparkline (Part 04, Phase 7). */
  trend?: number[];
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export interface AiInsight {
  id: string;
  severity: "info" | "warning" | "success";
  text: string;
}

export interface Meeting {
  id: string;
  title: string;
  time: string;
  attendees: number;
}

/** One spoke of the Dashboard hero's RadialGauge (Part 04, Phase 7). */
export interface HealthSegment {
  label: string;
  value: number;
  color: string;
}

export interface DashboardData {
  kpis: Kpi[];
  revenue: RevenuePoint[];
  pipeline: PipelineStage[];
  activity: ActivityItem[];
  insights: AiInsight[];
  meetings: Meeting[];
  /** Composite business-health score + breakdown, drives the hero's RadialGauge. */
  health: { score: number; segments: HealthSegment[] };
  /** Compact readouts under the gauge. */
  metrics: { runway: string; capacity: string; quarterPlan: string };
  quarterProgress: { weekLabel: string; percent: number };
  /** The emphasized phrase in the hero's directive line. */
  directive: string;
}
