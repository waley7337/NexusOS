import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Lead,
  LeadCreatePayload,
  LeadListParams,
  LeadUpdatePayload,
} from "../types";

const BASE = "/crm/leads";

function listQuery(params: LeadListParams = {}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  if (params.search) query.search = params.search;
  if (params.customerId) query.customerId = params.customerId;
  if (params.pipelineStage) query.pipelineStage = params.pipelineStage;
  if (params.assignedTo) query.assignedTo = params.assignedTo;
  return query;
}

export async function listLeads(
  params: LeadListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Lead>> {
  return request<Paginated<Lead>>({
    method: "GET",
    url: BASE,
    params: listQuery(params),
    signal,
  });
}

export async function getLead(id: string, signal?: AbortSignal): Promise<Lead> {
  return request<Lead>({
    method: "GET",
    url: `${BASE}/${id}`,
    signal,
  });
}

export async function createLead(payload: LeadCreatePayload): Promise<Lead> {
  return request<Lead>({
    method: "POST",
    url: BASE,
    data: payload,
  });
}

export async function updateLead(id: string, payload: LeadUpdatePayload): Promise<Lead> {
  return request<Lead>({
    method: "PATCH",
    url: `${BASE}/${id}`,
    data: payload,
  });
}

/** Soft-archives the lead (backend soft delete). */
export async function archiveLead(id: string): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${BASE}/${id}`,
  });
}
