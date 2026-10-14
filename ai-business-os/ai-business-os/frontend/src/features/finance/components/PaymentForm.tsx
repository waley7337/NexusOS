import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import {
  PAYMENT_METHODS,
  type ManualPaymentPayload,
  type PaymentMethod,
} from "../types";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
  stripe: "Stripe (manual record)",
  other: "Other",
};

export function PaymentForm({
  currency,
  busy,
  onCancel,
  onSubmit,
}: {
  currency: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: ManualPaymentPayload) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [notes, setNotes] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      amount: amount.trim(),
      currency,
      paymentDate,
      paymentMethod,
      notes: notes.trim() || null,
    });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Amount" required>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <Field label="Payment date" required>
        <Input
          type="date"
          required
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </Field>
      <Field label="Method" required>
        <Select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {METHOD_LABELS[method]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes">
        <Input
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        Currency is locked to the invoice ({currency}). This records a manual
        payment; it does not charge a card processor.
      </p>
      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
