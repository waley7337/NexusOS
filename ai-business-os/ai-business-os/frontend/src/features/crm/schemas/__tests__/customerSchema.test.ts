import { describe, expect, it } from "vitest";
import { customerFormSchema } from "../customerSchema";

describe("customerFormSchema", () => {
  it("requires company name", () => {
    const result = customerFormSchema.safeParse({
      companyName: "",
      industry: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      status: "lead",
      source: "",
      assignMeAsOwner: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload without system fields", () => {
    const result = customerFormSchema.safeParse({
      companyName: "Acme",
      industry: "",
      website: "",
      email: "a@example.com",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      status: "active",
      source: "",
      assignMeAsOwner: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("companyId");
      expect(result.data).not.toHaveProperty("createdBy");
      expect(result.data).not.toHaveProperty("id");
    }
  });

  it("rejects invalid status", () => {
    const result = customerFormSchema.safeParse({
      companyName: "Acme",
      industry: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      status: "pending",
      source: "",
      assignMeAsOwner: false,
    });
    expect(result.success).toBe(false);
  });
});
