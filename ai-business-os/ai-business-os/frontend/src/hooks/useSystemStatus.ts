import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import type { StatusPillVariant } from "@/components/ui/status-pill";

interface SystemStatus {
  variant: StatusPillVariant;
  label: string;
  lastSyncedAt: number | null;
}

/**
 * Derives shell status from the dashboard query's existing TanStack Query
 * cache (Part 04, Phase 5) — reads `getQueryState`, which does not create a
 * new observer or trigger a fetch, so mounting this in the always-on
 * AppLayout never loads dashboard data on pages that don't need it. Real
 * health-check wiring is a later part; this is chrome, not monitoring.
 */
export function useSystemStatus(): SystemStatus {
  const queryClient = useQueryClient();
  const state = queryClient.getQueryState(queryKeys.dashboard.summary);

  if (!state || state.status === "pending") {
    return { variant: "warning", label: "Syncing", lastSyncedAt: null };
  }
  if (state.status === "error") {
    return { variant: "offline", label: "Sync failed", lastSyncedAt: state.dataUpdatedAt || null };
  }
  return { variant: "online", label: "All systems nominal", lastSyncedAt: state.dataUpdatedAt };
}
