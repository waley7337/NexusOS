import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Invoice, InvoiceListParams, InvoicePayload, InvoiceUpdatePayload } from "../types";

const BASE = "/finance/invoices";

export function listInvoices(params: InvoiceListParams, signal?: AbortSignal): Promise<Paginated<Invoice>> {
  return request({ method: "GET", url: BASE, params, signal });
}
export function getInvoice(id: string, signal?: AbortSignal): Promise<Invoice> {
  return request({ method: "GET", url: `${BASE}/${id}`, signal });
}
export function createInvoice(payload: InvoicePayload): Promise<Invoice> {
  return request({ method: "POST", url: BASE, data: payload });
}
export function updateInvoice(id: string, payload: InvoiceUpdatePayload): Promise<Invoice> {
  return request({ method: "PATCH", url: `${BASE}/${id}`, data: payload });
}
export function sendInvoice(id: string): Promise<Invoice> {
  return request({ method: "POST", url: `${BASE}/${id}/send` });
}
export function voidInvoice(id: string): Promise<Invoice> {
  return request({ method: "POST", url: `${BASE}/${id}/void` });
}
export async function archiveInvoice(id: string): Promise<void> {
  await request<null>({ method: "DELETE", url: `${BASE}/${id}` });
}
