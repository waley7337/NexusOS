import { z } from "zod";

/** Mirrors the backend's `RegisterRequest`/`ResetPasswordRequest` password
 * rule (`app/schemas/auth.py`): at least 8 characters, letters and numbers. */
export const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (v) => !/^[0-9]+$/.test(v) && !/^[a-zA-Z]+$/.test(v),
    "Password must contain both letters and numbers",
  );

export const registerSchema = z
  .object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email address"),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
