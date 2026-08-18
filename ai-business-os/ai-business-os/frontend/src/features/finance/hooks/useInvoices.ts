import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/invoicesService";
import type { Invoice, InvoiceListParams, InvoicePayload, InvoiceUpdatePayload } from "../types";

export function useInvoices(params: InvoiceListParams) {
  return useQuery({ queryKey: queryKeys.finance.invoices.list(params as Record<string, unknown>), queryFn: ({ signal }) => service.listInvoices(params, signal) });
}
export function useInvoice(id?: string) {
  return useQuery({ queryKey: queryKeys.finance.invoices.detail(id ?? ""), queryFn: ({ signal }) => service.getInvoice(id!, signal), enabled: Boolean(id) });
}
function useInvoiceMutation<T>(mutationFn: (arg: T) => Promise<Invoice>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: (invoice) => {
    client.setQueryData(queryKeys.finance.invoices.detail(invoice.id), invoice);
    void client.invalidateQueries({ queryKey: queryKeys.finance.invoices.lists() });
  }});
}
export function useCreateInvoice() { return useInvoiceMutation<InvoicePayload>(service.createInvoice); }
export function useUpdateInvoice() { return useInvoiceMutation<{ id: string; payload: InvoiceUpdatePayload }>(({ id, payload }) => service.updateInvoice(id, payload)); }
export function useSendInvoice() { return useInvoiceMutation<string>(service.sendInvoice); }
export function useVoidInvoice() { return useInvoiceMutation<string>(service.voidInvoice); }
export function useArchiveInvoice() {
  const client = useQueryClient();
  return useMutation({ mutationFn: service.archiveInvoice, onSuccess: (_value, id) => {
    client.removeQueries({ queryKey: queryKeys.finance.invoices.detail(id) });
    void client.invalidateQueries({ queryKey: queryKeys.finance.invoices.lists() });
  }});
}
