import { ApiRequestError } from "@/api/client";

export interface ExpenseFormErrors {
  general?: string;
  fields: Partial<
    Record<"category" | "amount" | "currency" | "description" | "date" | "paidBy", string>
  >;
}

const TOP_LEVEL = new Set([
  "category",
  "amount",
  "currency",
  "description",
  "date",
  "paidBy",
]);

/** Maps stable FastAPI validation locations to expense form fields. */
export function expenseFormErrors(error: unknown): ExpenseFormErrors | null {
  if (!(error instanceof ApiRequestError)) return null;
  const mapped: ExpenseFormErrors = { fields: {} };
  let found = false;
  let hasUnmappedValidationError = false;
  for (const item of error.errors) {
    if (item.code !== "validation_error" || !item.field || !item.detail) continue;
    const parts = item.field.split(".");
    if (parts[0] !== "body") continue;
    if (parts.length === 2 && TOP_LEVEL.has(parts[1])) {
      mapped.fields[parts[1] as keyof ExpenseFormErrors["fields"]] = item.detail;
      found = true;
      continue;
    }
    hasUnmappedValidationError = true;
  }
  if (hasUnmappedValidationError) mapped.general = error.message;
  return found || mapped.general ? mapped : null;
}

export function clearExpenseFieldError(
  errors: ExpenseFormErrors | null | undefined,
  field: keyof ExpenseFormErrors["fields"],
): ExpenseFormErrors | null {
  if (!errors) return null;
  const fields = { ...errors.fields };
  delete fields[field];
  return { ...errors, fields };
}
