import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Contact,
  ContactCreatePayload,
  ContactListParams,
  ContactUpdatePayload,
} from "../types";

const BASE = "/crm/contacts";

function listQuery(params: ContactListParams = {}): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  if (params.search) query.search = params.search;
  if (params.customerId) query.customerId = params.customerId;
  return query;
}

export async function listContacts(
  params: ContactListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Contact>> {
  return request<Paginated<Contact>>({
    method: "GET",
    url: BASE,
    params: listQuery(params),
    signal,
  });
}

export async function getContact(id: string, signal?: AbortSignal): Promise<Contact> {
  return request<Contact>({
    method: "GET",
    url: `${BASE}/${id}`,
    signal,
  });
}

export async function createContact(payload: ContactCreatePayload): Promise<Contact> {
  return request<Contact>({
    method: "POST",
    url: BASE,
    data: payload,
  });
}

export async function updateContact(
  id: string,
  payload: ContactUpdatePayload,
): Promise<Contact> {
  return request<Contact>({
    method: "PATCH",
    url: `${BASE}/${id}`,
    data: payload,
  });
}

/** Soft-archives the contact (backend soft delete). */
export async function archiveContact(id: string): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${BASE}/${id}`,
  });
}
