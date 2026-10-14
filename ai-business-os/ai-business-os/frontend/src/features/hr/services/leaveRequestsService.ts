import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  LeaveRequest,
  LeaveRequestCreatePayload,
  LeaveRequestListParams,
} from "../types";

const BASE = "/hr/leave-requests";

export function listLeaveRequests(
  params: LeaveRequestListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<LeaveRequest>> {
  return request({ method: "GET", url: BASE, params, signal });
}

export function createLeaveRequest(
  payload: LeaveRequestCreatePayload,
): Promise<LeaveRequest> {
  return request({ method: "POST", url: BASE, data: payload });
}

export function approveLeaveRequest(id: string): Promise<LeaveRequest> {
  return request({ method: "POST", url: `${BASE}/${id}/approve` });
}

export function rejectLeaveRequest(id: string): Promise<LeaveRequest> {
  return request({ method: "POST", url: `${BASE}/${id}/reject` });
}
