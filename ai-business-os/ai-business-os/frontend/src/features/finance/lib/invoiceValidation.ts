import { ApiRequestError } from "@/api/client";

export interface InvoiceFormErrors {
  general?: string;
  fields: Partial<Record<"invoiceNumber" | "customerId" | "issueDate" | "dueDate" | "currency" | "tax" | "items", string>>;
  items: Record<number, Partial<Record<"description" | "quantity" | "unitPrice", string>>>;
}

const TOP_LEVEL = new Set(["invoiceNumber", "customerId", "issueDate", "dueDate", "currency", "tax", "items"]);
const ITEM_FIELDS = new Set(["description", "quantity", "unitPrice"]);

/** Maps only the stable FastAPI validation locations emitted by app.main. */
export function invoiceFormErrors(error: unknown): InvoiceFormErrors | null {
  if (!(error instanceof ApiRequestError)) return null;
  const mapped: InvoiceFormErrors = { fields: {}, items: {} };
  let found = false;
  let hasUnmappedValidationError = false;
  for (const item of error.errors) {
    if (item.code !== "validation_error" || !item.field || !item.detail) continue;
    const parts = item.field.split(".");
    if (parts[0] !== "body") continue;
    if (parts.length === 2 && TOP_LEVEL.has(parts[1])) {
      mapped.fields[parts[1] as keyof InvoiceFormErrors["fields"]] = item.detail;
      found = true;
      continue;
    }
    if (parts.length === 4 && parts[1] === "items" && /^\d+$/.test(parts[2]) && ITEM_FIELDS.has(parts[3])) {
      const index = Number(parts[2]);
      mapped.items[index] ??= {};
      mapped.items[index][parts[3] as "description" | "quantity" | "unitPrice"] = item.detail;
      found = true;
      continue;
    }
    hasUnmappedValidationError = true;
  }
  if (hasUnmappedValidationError) mapped.general = error.message;
  return found || mapped.general ? mapped : null;
}

export function clearInvoiceFieldError(
  errors: InvoiceFormErrors | null | undefined,
  field: keyof InvoiceFormErrors["fields"],
): InvoiceFormErrors | null {
  if (!errors) return null;
  const fields = { ...errors.fields };
  delete fields[field];
  return { ...errors, fields };
}

export function clearInvoiceItemError(
  errors: InvoiceFormErrors | null | undefined,
  index: number,
  field: "description" | "quantity" | "unitPrice",
): InvoiceFormErrors | null {
  if (!errors) return null;
  const items = { ...errors.items };
  const row = { ...items[index] };
  delete row[field];
  if (Object.keys(row).length > 0) items[index] = row;
  else delete items[index];
  return { ...errors, items };
}

/** Removing row N shifts only later backend-indexed errors down by one. */
export function removeInvoiceItemErrors(
  errors: InvoiceFormErrors | null | undefined,
  removedIndex: number,
): InvoiceFormErrors | null {
  if (!errors) return null;
  const items: InvoiceFormErrors["items"] = {};
  for (const [rawIndex, rowErrors] of Object.entries(errors.items)) {
    const index = Number(rawIndex);
    if (index < removedIndex) items[index] = rowErrors;
    if (index > removedIndex) items[index - 1] = rowErrors;
  }
  return { ...errors, items };
}
