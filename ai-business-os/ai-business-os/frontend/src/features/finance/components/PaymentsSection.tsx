import { useEffect, useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateInvoiceCheckout,
  useInvoicePayments,
  useRecordManualPayment,
  useRefundManualPayment,
} from "../hooks/usePayments";
import {
  PAYMENT_ELIGIBLE_INVOICE_STATUSES,
  type InvoiceStatus,
  type Payment,
} from "../types";
import { PaymentForm } from "./PaymentForm";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

function refundableBalance(payment: Payment): number {
  return Number(payment.amount) - Number(payment.refundedAmount);
}

export function PaymentsSection({
  invoiceId,
  currency,
  invoiceStatus,
}: {
  invoiceId: string;
  currency: string;
  invoiceStatus: InvoiceStatus;
}) {
  const canRead = usePermission("payments.read");
  const canCreate = usePermission("payments.create");
  const canRefund = usePermission("payments.refund");
  const paymentsQuery = useInvoicePayments(canRead ? invoiceId : undefined);
  const record = useRecordManualPayment(invoiceId);
  const refund = useRefundManualPayment();
  const checkout = useCreateInvoiceCheckout(invoiceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [recordOpen, setRecordOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const eligible = PAYMENT_ELIGIBLE_INVOICE_STATUSES.has(invoiceStatus);

  // Browser redirect is not confirmation — refresh authoritative backend state.
  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    if (!checkoutState) return;
    void paymentsQuery.refetch();
    toast.message(
      checkoutState === "success"
        ? "Payment submitted. Status updates after Stripe confirms the charge."
        : "Checkout canceled. No payment was recorded.",
    );
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
    // Intentional: run once when return query params are present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canRead) {
    return (
      <section className="rounded-card border border-line-soft bg-surface-2 p-5">
        <h2 className="text-sm font-semibold">Payments</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to view payments for this invoice.
        </p>
      </section>
    );
  }

  if (paymentsQuery.isPending) {
    return (
      <section aria-label="Loading payments" className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
      </section>
    );
  }

  if (paymentsQuery.isError) {
    return (
      <ErrorState
        title="Payments unavailable"
        description={errorMessage(paymentsQuery.error)}
        onRetry={() => void paymentsQuery.refetch()}
      />
    );
  }

  const rows = paymentsQuery.data?.items ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Payments</h2>
        {canCreate && eligible && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={checkout.isPending}
              onClick={() => {
                void (async () => {
                  try {
                    const session = await checkout.mutateAsync();
                    window.location.assign(session.checkoutUrl);
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                })();
              }}
            >
              <CreditCard /> Pay with Stripe
            </Button>
            <Button size="sm" onClick={() => setRecordOpen(true)}>
              <Plus /> Record payment
            </Button>
          </div>
        )}
      </div>
      {!eligible && (
        <p className="text-xs text-muted-foreground">
          Manual payments can be recorded when the invoice is sent, partially paid, or
          overdue.
        </p>
      )}
      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-soft bg-surface-2 p-6 text-sm text-muted-foreground">
          No payments recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-surface-3/80 text-left text-2xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Refunded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => {
                const remaining = refundableBalance(payment);
                const showRefund =
                  canRefund &&
                  payment.source === "manual" &&
                  payment.status === "completed" &&
                  remaining > 0;
                return (
                  <tr key={payment.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-3">{payment.paymentDate}</td>
                    <td className="px-4 py-3 capitalize">
                      {payment.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 capitalize">{payment.status}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {currency} {payment.amount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {currency} {payment.refundedAmount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {showRefund && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRefundTarget(payment);
                            setRefundAmount(remaining.toFixed(2));
                            setRefundReason("");
                          }}
                        >
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={recordOpen} onOpenChange={setRecordOpen}>
        <DrawerContent side="right" className="max-w-md">
          <DrawerHeader title="Record payment" />
          <DrawerBody>
            <PaymentForm
              currency={currency}
              busy={record.isPending}
              onCancel={() => setRecordOpen(false)}
              onSubmit={async (payload) => {
                try {
                  await record.mutateAsync(payload);
                  toast.success("Payment recorded");
                  setRecordOpen(false);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(refundTarget)}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
      >
        <DrawerContent side="right" className="max-w-md">
          <DrawerHeader title="Refund payment" />
          <DrawerBody>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!refundTarget) return;
                void (async () => {
                  try {
                    await refund.mutateAsync({
                      paymentId: refundTarget.id,
                      payload: {
                        amount: refundAmount.trim(),
                        reason: refundReason.trim(),
                      },
                    });
                    toast.success("Payment refunded");
                    setRefundTarget(null);
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                })();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Records a manual refund and updates the invoice balance. Does not reverse
                a card processor charge.
              </p>
              <Field label="Refund amount" required>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </Field>
              <Field label="Reason" required>
                <Input
                  maxLength={500}
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRefundTarget(null)}
                  disabled={refund.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" loading={refund.isPending}>
                  Refund
                </Button>
              </div>
            </form>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
