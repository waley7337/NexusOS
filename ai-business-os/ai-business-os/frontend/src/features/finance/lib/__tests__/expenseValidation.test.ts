import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/api/client";
import { expenseFormErrors } from "../expenseValidation";

describe("expenseFormErrors", () => {
  it("maps body field locations onto form fields", () => {
    const mapped = expenseFormErrors(
      new ApiRequestError("Invalid input.", [
        {
          code: "validation_error",
          field: "body.amount",
          detail: "Amount must be greater than zero.",
        },
      ]),
    );
    expect(mapped?.fields.amount).toBe("Amount must be greater than zero.");
  });

  it("strips Pydantic Value error prefix from field details", () => {
    const mapped = expenseFormErrors(
      new ApiRequestError("Invalid input.", [
        {
          code: "validation_error",
          field: "body.category",
          detail: "Value error, Category is required.",
        },
      ]),
    );
    expect(mapped?.fields.category).toBe("Category is required.");
  });

  it("returns null for non-API errors", () => {
    expect(expenseFormErrors(new Error("offline"))).toBeNull();
  });
});
