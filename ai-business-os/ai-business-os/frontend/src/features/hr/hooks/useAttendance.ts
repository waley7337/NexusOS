import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/attendanceService";
import type { AttendanceListParams } from "../types";

export function useAttendance(params: AttendanceListParams) {
  return useQuery({
    queryKey: queryKeys.hr.attendance.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => service.listAttendance(params, signal),
  });
}

export function useClockIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.clockIn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.hr.attendance.lists() });
    },
  });
}

export function useClockOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.clockOut,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.hr.attendance.lists() });
    },
  });
}
