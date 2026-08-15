/**
 * Dashboard operational snapshot.
 *
 * Business metrics (revenue, pipeline, activity, meetings) have no API yet.
 * This type only describes signals that already exist: liveness, readiness,
 * and the runtime environment returned by GET /health and GET /ready.
 */
export interface DashboardSnapshot {
  apiStatus: string;
  environment: string;
  database: "ok" | "unavailable";
}
