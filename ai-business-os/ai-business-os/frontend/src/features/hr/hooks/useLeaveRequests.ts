import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/leaveRequestsService";
import type { LeaveRequestCreatePayload, LeaveRequestListParams } from "../types";

export function useLeaveRequests(params: LeaveRequestListParams) {
  return useQuery({
    queryKey: queryKeys.hr.leaveRequests.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => service.listLeaveRequests(params, signal),
  });
}

export function useCreateLeaveRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaveRequestCreatePayload) =>
      service.createLeaveRequest(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.hr.leaveRequests.lists() });
    },
  });
}

export function useApproveLeaveRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.approveLeaveRequest,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.hr.leaveRequests.lists() });
    },
  });
}

export function useRejectLeaveRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.rejectLeaveRequest,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.hr.leaveRequests.lists() });
    },
  });
}
