import { describe, expect, it } from "vitest";
import { dealFormSchema, normalizeCurrency } from "../dealSchema";

const VALID_LEAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("dealFormSchema", () => {
  it("requires lead, value, currency and accepts real DealCreate fields", () => {
    const result = dealFormSchema.safeParse({
      leadId: VALID_LEAD,
      value: "12500.50",
      currency: "usd",
      status: "open",
      wonAt: "",
      lostReason: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("companyId");
      expect(result.data).not.toHaveProperty("customerId");
      expect(result.data).not.toHaveProperty("id");
      expect(result.data.status).toBe("open");
    }
  });

  it("rejects invented status and invalid currency", () => {
    expect(
      dealFormSchema.safeParse({
        leadId: VALID_LEAD,
        value: "100",
        currency: "US",
        status: "open",
        wonAt: "",
        lostReason: "",
      }).success,
    ).toBe(false);

    expect(
      dealFormSchema.safeParse({
        leadId: VALID_LEAD,
        value: "100",
        currency: "USD",
        status: "pending",
        wonAt: "",
        lostReason: "",
      }).success,
    ).toBe(false);
  });

  it("normalizes currency to uppercase ISO-3", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
  });
});
