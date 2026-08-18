import { describe, expect, it } from "vitest";
import { discoverableNavItems, NAV_ITEMS } from "../routes";

describe("permission-aware navigation discovery", () => {
  it("shows Finance with invoices.read for full and read-only users", () => {
    expect(discoverableNavItems(NAV_ITEMS, ["invoices.read"]).some(({ label }) => label === "Finance")).toBe(true);
    expect(discoverableNavItems(NAV_ITEMS, ["invoices.read", "invoices.create", "invoices.update"]).some(({ label }) => label === "Finance")).toBe(true);
  });

  it("fails closed for Finance without loaded read permission without hiding unrelated modules", () => {
    for (const permissions of [undefined, [], ["invoices.create"]]) {
      const visible = discoverableNavItems(NAV_ITEMS, permissions);
      expect(visible.some(({ label }) => label === "Finance")).toBe(false);
      expect(visible.some(({ label }) => label === "CRM")).toBe(true);
      expect(visible.some(({ label }) => label === "HR")).toBe(true);
    }
  });
});
