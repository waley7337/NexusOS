import { z } from "zod";

export const loginSchema = z.object({
  companySlug: z
    .string()
    .min(1, "Company URL is required")
    .max(80, "Company URL must not exceed 80 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only",
    ),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;