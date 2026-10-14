import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  ManualPaymentPayload,
  ManualRefundPayload,
  Payment,
} from "../types";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function listInvoicePayments(
  invoiceId: string,
  params: { page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<Paginated<Payment>> {
  return request({
    method: "GET",
    url: `/finance/invoices/${invoiceId}/payments`,
    params,
    signal,
  });
}

export function getPayment(paymentId: string, signal?: AbortSignal): Promise<Payment> {
  return request({
    method: "GET",
    url: `/finance/payments/${paymentId}`,
    signal,
  });
}

export function recordManualPayment(
  invoiceId: string,
  payload: ManualPaymentPayload,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<Payment> {
  return request({
    method: "POST",
    url: `/finance/invoices/${invoiceId}/payments`,
    data: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function refundManualPayment(
  paymentId: string,
  payload: ManualRefundPayload,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<Payment> {
  return request({
    method: "POST",
    url: `/finance/payments/${paymentId}/refund`,
    data: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export interface InvoiceCheckoutSession {
  paymentId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
  reused: boolean;
}

/** Starts Stripe Checkout for the server-computed outstanding balance. */
export function createInvoiceCheckout(
  invoiceId: string,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<InvoiceCheckoutSession> {
  return request({
    method: "POST",
    url: `/finance/invoices/${invoiceId}/checkout`,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
