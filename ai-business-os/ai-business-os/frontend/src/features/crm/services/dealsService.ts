import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Deal,
  DealCreatePayload,
  DealListParams,
  DealUpdatePayload,
} from "../types";

const BASE = "/crm/deals";

function listQuery(params: DealListParams = {}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  if (params.leadId) query.leadId = params.leadId;
  if (params.status) query.status = params.status;
  return query;
}

export async function listDeals(
  params: DealListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Deal>> {
  return request<Paginated<Deal>>({
    method: "GET",
    url: BASE,
    params: listQuery(params),
    signal,
  });
}

export async function getDeal(id: string, signal?: AbortSignal): Promise<Deal> {
  return request<Deal>({
    method: "GET",
    url: `${BASE}/${id}`,
    signal,
  });
}

export async function createDeal(payload: DealCreatePayload): Promise<Deal> {
  return request<Deal>({
    method: "POST",
    url: BASE,
    data: payload,
  });
}

export async function updateDeal(id: string, payload: DealUpdatePayload): Promise<Deal> {
  return request<Deal>({
    method: "PATCH",
    url: `${BASE}/${id}`,
    data: payload,
  });
}

/** Soft-archives the deal (backend soft delete). */
export async function archiveDeal(id: string): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${BASE}/${id}`,
  });
}
