import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { getDashboardMetrics } from "../services/dashboardService";

/**
 * React Query hook for tenant-scoped operational KPIs.
 * Calls GET /api/v1/dashboard/metrics — authentication required only.
 * Refetch on every mount so returning from module writes shows fresh counts.
 * Background refresh every 5 minutes.
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: queryKeys.dashboard.metrics,
    queryFn: getDashboardMetrics,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5 * 60 * 1000,
  });
}
