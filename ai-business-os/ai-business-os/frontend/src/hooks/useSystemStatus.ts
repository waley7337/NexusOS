import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useOnline } from "@/hooks/useOnline";
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
 *
 * Every state below is derived from a real signal — navigator.onLine via
 * useOnline, or the query cache's own status. Nothing is hardcoded, so the
 * shell status bar (Part 04 convergence, Commit C) reports honestly:
 *   offline  — the browser has lost connectivity
 *   syncing  — the dashboard query has never resolved
 *   degraded — the last fetch errored (stale data may still be on screen)
 *   healthy  — the query resolved
 */
export function useSystemStatus(): SystemStatus {
  const queryClient = useQueryClient();
  const online = useOnline();
  const state = queryClient.getQueryState(queryKeys.dashboard.summary);

  // Connectivity outranks cache state: a resolved cache entry means little
  // if the browser can no longer reach anything.
  if (!online) {
    return { variant: "offline", label: "Offline", lastSyncedAt: state?.dataUpdatedAt || null };
  }
  if (!state || state.status === "pending") {
    return { variant: "warning", label: "Syncing", lastSyncedAt: null };
  }
  if (state.status === "error") {
    return { variant: "offline", label: "Sync failed", lastSyncedAt: state.dataUpdatedAt || null };
  }
  return { variant: "online", label: "All systems nominal", lastSyncedAt: state.dataUpdatedAt };
}
