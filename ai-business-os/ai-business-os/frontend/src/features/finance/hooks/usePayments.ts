import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/paymentsService";
import type { ManualPaymentPayload, ManualRefundPayload, Payment } from "../types";

export function useInvoicePayments(invoiceId?: string) {
  return useQuery({
    queryKey: queryKeys.finance.payments.list(invoiceId ?? ""),
    queryFn: ({ signal }) => service.listInvoicePayments(invoiceId!, {}, signal),
    enabled: Boolean(invoiceId),
  });
}

function invalidatePaymentViews(
  client: ReturnType<typeof useQueryClient>,
  payment: Payment,
) {
  void client.invalidateQueries({
    queryKey: queryKeys.finance.payments.list(payment.invoiceId),
  });
  void client.invalidateQueries({
    queryKey: queryKeys.finance.invoices.detail(payment.invoiceId),
  });
  void client.invalidateQueries({ queryKey: queryKeys.finance.invoices.lists() });
}

export function useRecordManualPayment(invoiceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualPaymentPayload) =>
      service.recordManualPayment(invoiceId, payload),
    onSuccess: (payment) => invalidatePaymentViews(client, payment),
  });
}

export function useRefundManualPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      paymentId,
      payload,
    }: {
      paymentId: string;
      payload: ManualRefundPayload;
    }) => service.refundManualPayment(paymentId, payload),
    onSuccess: (payment) => invalidatePaymentViews(client, payment),
  });
}

export function useCreateInvoiceCheckout(invoiceId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => service.createInvoiceCheckout(invoiceId),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: queryKeys.finance.payments.list(invoiceId),
      });
      void client.invalidateQueries({
        queryKey: queryKeys.finance.invoices.detail(invoiceId),
      });
    },
  });
}
