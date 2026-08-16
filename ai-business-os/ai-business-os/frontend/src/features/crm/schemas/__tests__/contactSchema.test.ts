import { describe, expect, it } from "vitest";
import { contactFormSchema } from "../contactSchema";

const VALID_CUSTOMER = "11111111-1111-4111-8111-111111111111";

describe("contactFormSchema", () => {
  it("requires customer, first name, and last name", () => {
    const result = contactFormSchema.safeParse({
      customerId: "",
      firstName: "",
      lastName: "",
      position: "",
      email: "",
      phone: "",
      linkedin: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload without inventing protected fields", () => {
    const result = contactFormSchema.safeParse({
      customerId: VALID_CUSTOMER,
      firstName: "Ada",
      lastName: "Lovelace",
      position: "Engineer",
      email: "ada@example.com",
      phone: "",
      linkedin: "",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("companyId");
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("job_title");
      expect(result.data).toHaveProperty("position", "Engineer");
    }
  });

  it("rejects invalid email when provided", () => {
    const result = contactFormSchema.safeParse({
      customerId: VALID_CUSTOMER,
      firstName: "Ada",
      lastName: "Lovelace",
      position: "",
      email: "not-an-email",
      phone: "",
      linkedin: "",
      notes: "",
    });
    expect(result.success).toBe(false);
  });
});
