import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { listEmployees } from "../services/employeesService";

/** Bounded employee list for manager pickers (Owner/Admin). */
export function useEmployeeOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.hr.employees.options(),
    queryFn: ({ signal }) =>
      listEmployees({ page: 1, pageSize: 100, sortBy: "last_name", sortDesc: false }, signal),
    enabled,
    select: (data) => data.items,
  });
}
