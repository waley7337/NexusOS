import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { getDashboardMetrics } from "../services/dashboardService";

/**
 * React Query hook for tenant-scoped operational KPIs.
 * Calls GET /api/v1/dashboard/metrics — authentication required only.
 * Refreshes every 5 minutes; stale after 2 minutes.
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics,
    queryFn: getDashboardMetrics,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
