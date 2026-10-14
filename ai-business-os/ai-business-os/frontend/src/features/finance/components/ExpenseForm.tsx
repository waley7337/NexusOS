import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  clearExpenseFieldError,
  type ExpenseFormErrors,
} from "../lib/expenseValidation";
import type { Expense, ExpensePayload } from "../types";

export function ExpenseForm({
  expense,
  busy,
  errors,
  onErrorsChange,
  onCancel,
  onSubmit,
}: {
  expense?: Expense;
  busy: boolean;
  errors?: ExpenseFormErrors | null;
  onErrorsChange: (errors: ExpenseFormErrors | null) => void;
  onCancel: () => void;
  onSubmit: (payload: ExpensePayload) => void;
}) {
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [currency, setCurrency] = useState(expense?.currency ?? "USD");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense?.date ?? "");

  const clearField = (field: keyof ExpenseFormErrors["fields"]) =>
    onErrorsChange(clearExpenseFieldError(errors, field));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      category: category.trim(),
      amount: amount.trim(),
      currency: currency.trim().toUpperCase(),
      description: description.trim() || null,
      date,
    });
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      {errors?.general && (
        <p role="alert" className="text-sm text-destructive">
          {errors.general}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required error={errors?.fields.category}>
          <Input
            maxLength={100}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              clearField("category");
            }}
            placeholder="Travel, Meals, Office…"
          />
        </Field>
        <Field label="Date" required error={errors?.fields.date}>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clearField("date");
            }}
          />
        </Field>
        <Field label="Amount" required error={errors?.fields.amount}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              clearField("amount");
            }}
            placeholder="0.00"
          />
        </Field>
        <Field label="Currency" required error={errors?.fields.currency}>
          <Input
            minLength={3}
            maxLength={3}
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              clearField("currency");
            }}
          />
        </Field>
      </div>
      <Field label="Description" error={errors?.fields.description}>
        <Input
          maxLength={2000}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearField("description");
          }}
          placeholder="Optional notes"
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {expense ? "Save changes" : "Create expense"}
        </Button>
      </div>
    </form>
  );
}
