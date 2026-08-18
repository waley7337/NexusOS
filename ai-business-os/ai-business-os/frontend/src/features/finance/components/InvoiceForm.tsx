import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { useCustomerOptions } from "@/features/crm/hooks/useCustomerOptions";
import { clearInvoiceFieldError, clearInvoiceItemError, removeInvoiceItemErrors, type InvoiceFormErrors } from "../lib/invoiceValidation";
import type { Invoice, InvoiceItemInput, InvoicePayload } from "../types";

const emptyItem = (): InvoiceItemInput => ({ description: "", quantity: "1", unitPrice: "0" });

export function InvoiceForm({ invoice, busy, errors, onErrorsChange, onCancel, onSubmit }: {
  invoice?: Invoice; busy: boolean; errors?: InvoiceFormErrors | null; onErrorsChange: (errors: InvoiceFormErrors | null) => void; onCancel: () => void; onSubmit: (payload: InvoicePayload) => void;
}) {
  const customers = useCustomerOptions(true);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? "");
  const [customerId, setCustomerId] = useState(invoice?.customerId ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? "");
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [tax, setTax] = useState(invoice?.tax ?? "0");
  const [items, setItems] = useState<InvoiceItemInput[]>(invoice?.items.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })) ?? [emptyItem()]);

  const customerOptions = invoice && !customers.customers.some(({ id }) => id === invoice.customerId)
    ? [{ id: invoice.customerId, companyName: invoice.customerName }, ...customers.customers]
    : customers.customers;
  const updateItem = (index: number, patch: Partial<InvoiceItemInput>) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const clearField = (field: keyof InvoiceFormErrors["fields"]) => onErrorsChange(clearInvoiceFieldError(errors, field));
  const clearItemField = (index: number, field: "description" | "quantity" | "unitPrice") => onErrorsChange(clearInvoiceItemError(errors, index, field));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ invoiceNumber: invoiceNumber.trim(), customerId, issueDate, dueDate, currency: currency.toUpperCase(), tax, items });
  };

  return <form className="space-y-5" onSubmit={submit}>
    {errors?.general && <p role="alert" className="text-sm text-destructive">{errors.general}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Invoice number" required error={errors?.fields.invoiceNumber}><Input maxLength={40} value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); clearField("invoiceNumber"); }} /></Field>
      <Field label="Customer" required error={errors?.fields.customerId}><Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); clearField("customerId"); }} disabled={customers.isPending}><option value="">Select customer</option>{customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}</Select></Field>
      <Field label="Issue date" required error={errors?.fields.issueDate}><Input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); clearField("issueDate"); }} /></Field>
      <Field label="Due date" required error={errors?.fields.dueDate}><Input type="date" min={issueDate} value={dueDate} onChange={(e) => { setDueDate(e.target.value); clearField("dueDate"); }} /></Field>
      <Field label="Currency" required error={errors?.fields.currency}><Input minLength={3} maxLength={3} value={currency} onChange={(e) => { setCurrency(e.target.value); clearField("currency"); }} /></Field>
      <Field label="Tax" required error={errors?.fields.tax}><Input type="number" min="0" step="0.01" value={tax} onChange={(e) => { setTax(e.target.value); clearField("tax"); }} /></Field>
    </div>
    <fieldset className="space-y-3"><legend className="text-sm font-semibold">Line items</legend>
      {errors?.fields.items && <p role="alert" className="text-xs text-destructive">{errors.fields.items}</p>}
      {items.map((item, index) => <div key={index} className="grid gap-2 rounded-card border border-line-soft bg-surface-1 p-3 sm:grid-cols-[1fr_7rem_9rem_auto]">
        <Field label="Description" required error={errors?.items[index]?.description}><Input maxLength={500} value={item.description} onChange={(e) => { updateItem(index, { description: e.target.value }); clearItemField(index, "description"); }} /></Field>
        <Field label="Quantity" required error={errors?.items[index]?.quantity}><Input type="number" min="0" step="any" value={item.quantity} onChange={(e) => { updateItem(index, { quantity: e.target.value }); clearItemField(index, "quantity"); }} /></Field>
        <Field label="Unit price" required error={errors?.items[index]?.unitPrice}><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => { updateItem(index, { unitPrice: e.target.value }); clearItemField(index, "unitPrice"); }} /></Field>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove line item ${index + 1}`} disabled={items.length === 1} onClick={() => { setItems((rows) => rows.filter((_, i) => i !== index)); onErrorsChange(removeInvoiceItemErrors(clearInvoiceFieldError(errors, "items"), index)); }}><Trash2 /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => { setItems((rows) => [...rows, emptyItem()]); clearField("items"); }}><Plus /> Add line item</Button>
    </fieldset>
    <p className="text-xs text-muted-foreground">Totals are calculated authoritatively by NexusOS when you save.</p>
    <div className="flex justify-end gap-2 border-t border-line-soft pt-4"><Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="submit" loading={busy}>{invoice ? "Save changes" : "Create invoice"}</Button></div>
  </form>;
}
