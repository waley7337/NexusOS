import { describe, expect, it } from "vitest";
import { clearInvoiceItemError, removeInvoiceItemErrors, type InvoiceFormErrors } from "../invoiceValidation";

const errors: InvoiceFormErrors = {
  fields: { invoiceNumber: "Required", items: "Review line items" },
  items: {
    0: { quantity: "First quantity" },
    1: { unitPrice: "Second price", description: "Second description" },
    2: { quantity: "Third quantity" },
  },
};

describe("invoice indexed error lifecycle", () => {
  it("removes the deleted row errors and shifts only later logical rows", () => {
    expect(removeInvoiceItemErrors(errors, 0)).toEqual({
      fields: errors.fields,
      items: {
        0: { unitPrice: "Second price", description: "Second description" },
        1: { quantity: "Third quantity" },
      },
    });
  });

  it("clears only the edited field and preserves general and sibling errors", () => {
    expect(clearInvoiceItemError(errors, 1, "unitPrice")).toEqual({
      fields: errors.fields,
      items: {
        0: { quantity: "First quantity" },
        1: { description: "Second description" },
        2: { quantity: "Third quantity" },
      },
    });
  });
});
