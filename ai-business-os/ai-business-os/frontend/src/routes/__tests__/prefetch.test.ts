import { describe, expect, it } from "vitest";
import { FINANCE_FEATURE_MODULE_ID } from "../prefetch";

describe("finance route prefetch", () => {
  it("targets the live finance feature module instead of ModulePlaceholders", () => {
    expect(FINANCE_FEATURE_MODULE_ID).toBe("@/features/finance");
    expect(FINANCE_FEATURE_MODULE_ID).not.toContain("placeholders");
  });

  it("resolves the finance feature exports used by lazy routes", async () => {
    const feature = await import("@/features/finance");
    expect(feature.InvoicesPage).toBeTypeOf("function");
    expect(feature.InvoiceDetailPage).toBeTypeOf("function");
  });
});
