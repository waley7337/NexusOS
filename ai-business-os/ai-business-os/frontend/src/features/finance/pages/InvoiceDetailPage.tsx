import { useState } from "react";
import { ArrowLeft, Archive, Pencil, Send, ShieldX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { InvoiceForm } from "../components/InvoiceForm";
import { PaymentsSection } from "../components/PaymentsSection";
import { useArchiveInvoice, useInvoice, useSendInvoice, useUpdateInvoice, useVoidInvoice } from "../hooks/useInvoices";
import { invoiceFormErrors, type InvoiceFormErrors } from "../lib/invoiceValidation";
import type { InvoiceStatus } from "../types";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

/** Statuses the backend rejects for void — keep UI aligned; auth remains server-side. */
const VOID_INELIGIBLE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  "paid",
  "void",
  "partially_paid",
]);

function money(value: string, currency: string) {
  return `${currency} ${value}`;
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const query = useInvoice(invoiceId);
  const canUpdate = usePermission("invoices.update");
  const canSend = usePermission("invoices.send");
  const canArchive = usePermission("invoices.delete");
  const update = useUpdateInvoice();
  const send = useSendInvoice();
  const voidMutation = useVoidInvoice();
  const archive = useArchiveInvoice();
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<"send" | "void" | "archive" | null>(null);
  const [formErrors, setFormErrors] = useState<InvoiceFormErrors | null>(null);

  if (query.isPending) {
    return (
      <div aria-label="Loading invoice" className="space-y-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Invoice unavailable"
        description={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const invoice = query.data;
  const draft = invoice.status === "draft";
  const canVoid = canUpdate && !VOID_INELIGIBLE_STATUSES.has(invoice.status);

  const act = async () => {
    if (!confirm || !invoiceId) return;
    try {
      if (confirm === "send") await send.mutateAsync(invoiceId);
      if (confirm === "void") await voidMutation.mutateAsync(invoiceId);
      if (confirm === "archive") {
        await archive.mutateAsync(invoiceId);
        navigate("/finance/invoices");
      }
      toast.success(
        confirm === "send"
          ? "Invoice marked as sent"
          : confirm === "void"
            ? "Invoice voided"
            : "Invoice archived",
      );
      setConfirm(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/finance/invoices")}>
        <ArrowLeft /> Back to invoices
      </Button>
      <PageHeader
        title={invoice.invoiceNumber}
        description={invoice.customerName}
        actions={
          <div className="flex flex-wrap gap-2">
            {canUpdate && draft && (
              <Button
                variant="outline"
                onClick={() => {
                  setFormErrors(null);
                  setEditOpen(true);
                }}
              >
                <Pencil /> Edit draft
              </Button>
            )}
            {canSend && draft && (
              <Button onClick={() => setConfirm("send")}>
                <Send /> Mark as sent
              </Button>
            )}
            {canVoid && (
              <Button variant="outline" onClick={() => setConfirm("void")}>
                <ShieldX /> Void
              </Button>
            )}
            {canArchive && draft && (
              <Button variant="danger" onClick={() => setConfirm("archive")}>
                <Archive /> Archive
              </Button>
            )}
          </div>
        }
      />
      <section className="rounded-card border border-line-soft bg-surface-2 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Status" value={invoice.status.replace("_", " ")} capitalize />
          <Fact label="Issue date" value={invoice.issueDate} />
          <Fact label="Due date" value={invoice.dueDate} />
          <Fact label="Currency" value={invoice.currency} />
        </div>
      </section>
      <section className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft bg-surface-3/80 text-left text-2xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">{item.unitPrice}</td>
                <td className="px-4 py-3 text-right font-mono">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto grid max-w-sm grid-cols-2 gap-2 border-t border-line-soft p-4 text-sm">
          <span>Subtotal</span>
          <strong className="text-right font-mono">{invoice.subtotal}</strong>
          <span>Tax</span>
          <strong className="text-right font-mono">{invoice.tax}</strong>
          <span>Total ({invoice.currency})</span>
          <strong className="text-right font-mono">{invoice.total}</strong>
          <span>Amount paid</span>
          <strong className="text-right font-mono" data-testid="invoice-amount-paid">
            {money(invoice.amountPaid, invoice.currency)}
          </strong>
          <span>Outstanding</span>
          <strong className="text-right font-mono" data-testid="invoice-outstanding-balance">
            {money(invoice.outstandingBalance, invoice.currency)}
          </strong>
        </div>
      </section>
      <PaymentsSection
        invoiceId={invoice.id}
        currency={invoice.currency}
        invoiceStatus={invoice.status}
      />
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent side="right" className="max-w-2xl">
          <DrawerHeader title="Edit draft invoice" />
          <DrawerBody>
            <InvoiceForm
              invoice={invoice}
              busy={update.isPending}
              errors={formErrors}
              onErrorsChange={setFormErrors}
              onCancel={() => setEditOpen(false)}
              onSubmit={async (payload) => {
                setFormErrors(null);
                try {
                  await update.mutateAsync({ id: invoice.id, payload });
                  toast.success("Invoice updated");
                  setEditOpen(false);
                } catch (error) {
                  const mapped = invoiceFormErrors(error);
                  if (mapped) setFormErrors(mapped);
                  else toast.error(errorMessage(error));
                }
              }}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "send"
            ? "Mark invoice as sent?"
            : confirm === "void"
              ? "Void this invoice?"
              : "Archive this draft?"
        }
        description={
          confirm === "send"
            ? "This records an internal lifecycle transition. It does not email the customer or create a PDF."
            : confirm === "void"
              ? "The invoice will move to VOID. This does not delete it."
              : "The draft will be soft-archived and removed from the active list."
        }
        confirmLabel={
          confirm === "send" ? "Mark as sent" : confirm === "void" ? "Void invoice" : "Archive draft"
        }
        destructive={confirm !== "send"}
        loading={send.isPending || voidMutation.isPending || archive.isPending}
        onConfirm={() => void act()}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={capitalize ? "mt-1 capitalize" : "mt-1"}>{value}</dd>
    </div>
  );
}
