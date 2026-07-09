export interface Kpi {
  id: string;
  label: string;
  value: string;
  delta: number; // % vs last period
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

export interface DashboardData {
  kpis: Kpi[];
  revenue: RevenuePoint[];
  pipeline: PipelineStage[];
  activity: ActivityItem[];
  insights: AiInsight[];
  meetings: Meeting[];
}
