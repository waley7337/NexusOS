import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useOnline } from "@/hooks/useOnline";
import type { StatusPillVariant } from "@/components/ui/status-pill";
import type { DashboardSnapshot } from "@/features/dashboard/types";

interface SystemStatus {
  variant: StatusPillVariant;
  label: string;
  lastSyncedAt: number | null;
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

  if (!online) {
    return { variant: "offline", label: "Offline", lastSyncedAt: state?.dataUpdatedAt || null };
  }
  if (!state || state.status === "pending") {
    return { variant: "warning", label: "Syncing", lastSyncedAt: null };
  }
  if (state.status === "error") {
    return { variant: "offline", label: "Sync failed", lastSyncedAt: state.dataUpdatedAt || null };
  }

  const snapshot = state.data;
  if (!snapshot || snapshot.apiStatus !== "ok") {
    return { variant: "offline", label: "API unreachable", lastSyncedAt: state.dataUpdatedAt };
  }
  if (snapshot.database !== "ok") {
    return { variant: "warning", label: "Database unavailable", lastSyncedAt: state.dataUpdatedAt };
  }
  return { variant: "online", label: "Connected", lastSyncedAt: state.dataUpdatedAt };
}
