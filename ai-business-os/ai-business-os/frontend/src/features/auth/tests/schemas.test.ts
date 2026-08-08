import { describe, expect, it } from "vitest";
import { loginSchema } from "../schemas/loginSchema";
import { registerSchema } from "../schemas/registerSchema";
import { forgotPasswordSchema } from "../schemas/forgotPasswordSchema";
import { resetPasswordSchema } from "../schemas/resetPasswordSchema";

describe("loginSchema", () => {
  const validLogin = {
    companySlug: "acme",
    email: "jane@acme.com",
    password: "anything",
  };

  it("accepts a valid company URL, email, and non-empty password", () => {
    const result = loginSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ ...validLogin, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ ...validLogin, password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed company URL", () => {
    const result = loginSchema.safeParse({ ...validLogin, companySlug: "Acme Company" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    companyName: "Acme Inc.",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@acme.com",
  };

  it("accepts a valid payload with matching passwords", () => {
    const result = registerSchema.safeParse({
      ...base,
      password: "Secret123",
      confirmPassword: "Secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      ...base,
      password: "Secret123",
      confirmPassword: "Different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("rejects an all-letters password (mirrors backend rule)", () => {
    const result = registerSchema.safeParse({
      ...base,
      password: "alllettersnodigits",
      confirmPassword: "alllettersnodigits",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an all-digits password (mirrors backend rule)", () => {
    const result = registerSchema.safeParse({
      ...base,
      password: "12345678",
      confirmPassword: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...base, password: "ab1", confirmPassword: "ab1" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "jane@acme.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching, strong passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "Secret123", confirmPassword: "Secret123" }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: "Secret123", confirmPassword: "Nope123" }).success,
    ).toBe(false);
  });
});
