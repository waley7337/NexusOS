import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  CustomerNote,
  CustomerNoteCreatePayload,
  CustomerNoteListParams,
  CustomerNoteUpdatePayload,
} from "../types";

function basePath(customerId: string): string {
  return `/crm/customers/${customerId}/notes`;
}

function listQuery(
  params: CustomerNoteListParams = {},
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  if (params.page != null) query.page = params.page;
  if (params.pageSize != null) query.pageSize = params.pageSize;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortDesc != null) query.sortDesc = params.sortDesc;
  return query;
}

export async function listCustomerNotes(
  customerId: string,
  params: CustomerNoteListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<CustomerNote>> {
  return request<Paginated<CustomerNote>>({
    method: "GET",
    url: basePath(customerId),
    params: listQuery(params),
    signal,
  });
}

export async function createCustomerNote(
  customerId: string,
  payload: CustomerNoteCreatePayload,
): Promise<CustomerNote> {
  return request<CustomerNote>({
    method: "POST",
    url: basePath(customerId),
    data: payload,
  });
}

export async function updateCustomerNote(
  customerId: string,
  noteId: string,
  payload: CustomerNoteUpdatePayload,
): Promise<CustomerNote> {
  return request<CustomerNote>({
    method: "PATCH",
    url: `${basePath(customerId)}/${noteId}`,
    data: payload,
  });
}

/** Soft-archives the note (backend soft delete). */
export async function archiveCustomerNote(
  customerId: string,
  noteId: string,
): Promise<void> {
  await request<null>({
    method: "DELETE",
    url: `${basePath(customerId)}/${noteId}`,
  });
}
