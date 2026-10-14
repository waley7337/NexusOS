import { describe, expect, it } from "vitest";
import { NAV_ITEMS, discoverableNavItems } from "@/constants/routes";

describe("Finance sidebar RBAC (product constraint)", () => {
  it("gates Finance nav on invoices.read only", () => {
    const finance = NAV_ITEMS.find((item) => item.to === "/finance");
    expect(finance?.permission).toBe("invoices.read");
  });

  it("hides Finance when invoices.read is absent even if payments.* exist", () => {
    const items = discoverableNavItems(NAV_ITEMS, [
      "payments.read",
      "payments.create",
      "expenses.read",
      "finance.view",
    ]);
    expect(items.some((item) => item.to === "/finance")).toBe(false);
  });

  it("shows Finance when invoices.read is present", () => {
    const items = discoverableNavItems(NAV_ITEMS, ["invoices.read"]);
    expect(items.some((item) => item.to === "/finance")).toBe(true);
  });
});
