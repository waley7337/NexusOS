import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { getDashboard } from "../services/dashboardService";

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: getDashboard,
  });
}
