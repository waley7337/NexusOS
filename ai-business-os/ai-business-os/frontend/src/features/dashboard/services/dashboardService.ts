import { request } from "@/api/client";
import type { DashboardSnapshot } from "../types";

interface HealthPayload {
  status: string;
  environment: string;
}

interface ReadyPayload {
  database: string;
}

/**
 * Operational snapshot for Mission Control.
 *
 * Calls existing liveness/readiness probes. Does not invent KPIs, charts,
 * or activity. CRM/finance aggregates are omitted until those APIs exist.
 */
export async function getDashboard(): Promise<DashboardSnapshot> {
  const api = await request<HealthPayload>({ method: "GET", url: "/health" });

  let database: DashboardSnapshot["database"] = "unavailable";
  try {
    const ready = await request<ReadyPayload>({ method: "GET", url: "/ready" });
    if (ready.database === "ok") database = "ok";
  } catch {
    database = "unavailable";
  }

  return {
    apiStatus: api.status,
    environment: api.environment,
    database,
  };
}
