import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useOnline } from "@/hooks/useOnline";
import type { StatusPillVariant } from "@/components/ui/status-pill";
import type { DashboardSnapshot } from "@/features/dashboard/types";

/** One probe's condition, for the shell's machine register. */
export type ProbeState = "ok" | "down" | "unknown";

interface SystemStatus {
  variant: StatusPillVariant;
  label: string;
  lastSyncedAt: number | null;
  /**
   * V3: the individual probe results, so the shell can render a machine
   * register (`API / READY   DB / READY`) instead of one collapsed
   * sentence. Purely additive — derived from the same cached snapshot this
   * hook already reads, no new request and no new source of truth.
   * "unknown" is a real third state: it means the probe has not resolved,
   * which is not the same as reporting a failure.
   */
  api: ProbeState;
  db: ProbeState;
  environment: string | null;
}

/**
 * Derives shell status from navigator.onLine and the dashboard operational
 * snapshot cache (GET /health + GET /ready). Reads `getQueryState` so
 * AppLayout never starts that fetch on pages that don't need it.
 *
 *   offline  — the browser has lost connectivity
 *   syncing  — health probes have never resolved
 *   failed   — liveness probe errored
 *   warning  — API is up but the database probe is not
 *   healthy  — both probes succeeded
 */
export function useSystemStatus(): SystemStatus {
  const queryClient = useQueryClient();
  const online = useOnline();
  const state = queryClient.getQueryState<DashboardSnapshot>(queryKeys.dashboard.summary);

  const snapshot = state?.data;
  const environment = snapshot?.environment ?? null;

  if (!online) {
    return {
      variant: "offline",
      label: "Offline",
      lastSyncedAt: state?.dataUpdatedAt || null,
      api: "unknown",
      db: "unknown",
      environment,
    };
  }
  if (!state || state.status === "pending") {
    return {
      variant: "warning",
      label: "Syncing",
      lastSyncedAt: null,
      api: "unknown",
      db: "unknown",
      environment,
    };
  }
  if (state.status === "error") {
    return {
      variant: "offline",
      label: "Sync failed",
      lastSyncedAt: state.dataUpdatedAt || null,
      api: "down",
      db: "unknown",
      environment,
    };
  }

  if (!snapshot || snapshot.apiStatus !== "ok") {
    return {
      variant: "offline",
      label: "API unreachable",
      lastSyncedAt: state.dataUpdatedAt,
      api: "down",
      db: "unknown",
      environment,
    };
  }
  if (snapshot.database !== "ok") {
    return {
      variant: "warning",
      label: "Database unavailable",
      lastSyncedAt: state.dataUpdatedAt,
      api: "ok",
      db: "down",
      environment,
    };
  }
  return {
    variant: "online",
    label: "Connected",
    lastSyncedAt: state.dataUpdatedAt,
    api: "ok",
    db: "ok",
    environment,
  };
}
