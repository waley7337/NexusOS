import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Customer,
  CustomerCreatePayload,
  CustomerListParams,
  CustomerUpdatePayload,
} from "../types";

const BASE = "/crm/customers";

function listQuery(params: CustomerListParams = {}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  if (params.search) query.search = params.search;
  if (params.status) query.status = params.status;
  if (params.ownerId) query.ownerId = params.ownerId;
  return query;
}

export async function listCustomers(
  params: CustomerListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Customer>> {
  return request<Paginated<Customer>>({
    method: "GET",
    url: BASE,
    params: listQuery(params),
    signal,
  });
}

export async function getCustomer(id: string, signal?: AbortSignal): Promise<Customer> {
  return request<Customer>({
    method: "GET",
    url: `${BASE}/${id}`,
    signal,
  });
}

export async function createCustomer(payload: CustomerCreatePayload): Promise<Customer> {
  return request<Customer>({
    method: "POST",
    url: BASE,
    data: payload,
  });
}

export async function updateCustomer(
  id: string,
  payload: CustomerUpdatePayload,
): Promise<Customer> {
  return request<Customer>({
    method: "PATCH",
    url: `${BASE}/${id}`,
    data: payload,
  });
}

/** Soft-archives the customer (backend soft delete). */
export async function archiveCustomer(id: string): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${BASE}/${id}`,
  });
}
