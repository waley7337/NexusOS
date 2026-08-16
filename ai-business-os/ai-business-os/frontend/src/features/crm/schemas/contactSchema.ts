import { z } from "zod";

export const contactFormSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  position: z.string().max(120),
  email: z
    .string()
    .refine((v) => v.trim() === "" || z.string().email().safeParse(v.trim()).success, {
      message: "Enter a valid email",
    }),
  phone: z.string().max(40),
  linkedin: z.string().max(255),
  notes: z.string(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
