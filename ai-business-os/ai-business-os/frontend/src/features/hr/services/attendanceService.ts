import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { AttendanceListParams, AttendanceRecord } from "../types";

const BASE = "/hr/attendance";

export function listAttendance(
  params: AttendanceListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<AttendanceRecord>> {
  return request({ method: "GET", url: BASE, params, signal });
}

export function clockIn(): Promise<AttendanceRecord> {
  return request({ method: "POST", url: `${BASE}/clock-in` });
}

export function clockOut(): Promise<AttendanceRecord> {
  return request({ method: "POST", url: `${BASE}/clock-out` });
}
