import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Employee,
  EmployeeCreatePayload,
  EmployeeListParams,
  EmployeeUpdatePayload,
} from "../types";

const BASE = "/hr/employees";

function listQuery(
  params: EmployeeListParams = {},
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  if (params.search) query.search = params.search;
  if (params.status) query.status = params.status;
  if (params.employmentType) query.employmentType = params.employmentType;
  if (params.managerId) query.managerId = params.managerId;
  return query;
}

export async function listEmployees(
  params: EmployeeListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Employee>> {
  return request<Paginated<Employee>>({
    method: "GET",
    url: BASE,
    params: listQuery(params),
    signal,
  });
}

export async function getEmployee(id: string, signal?: AbortSignal): Promise<Employee> {
  return request<Employee>({
    method: "GET",
    url: `${BASE}/${id}`,
    signal,
  });
}

export async function createEmployee(payload: EmployeeCreatePayload): Promise<Employee> {
  return request<Employee>({
    method: "POST",
    url: BASE,
    data: payload,
  });
}

export async function updateEmployee(
  id: string,
  payload: EmployeeUpdatePayload,
): Promise<Employee> {
  return request<Employee>({
    method: "PATCH",
    url: `${BASE}/${id}`,
    data: payload,
  });
}

/** Soft-archives the employee (backend soft delete). */
export async function archiveEmployee(id: string): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${BASE}/${id}`,
  });
}
