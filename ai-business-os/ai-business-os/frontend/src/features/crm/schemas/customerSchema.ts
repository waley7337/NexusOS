import { z } from "zod";
import { CUSTOMER_STATUSES } from "../types";

export const customerFormSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  industry: z.string().max(100),
  website: z.string().max(255),
  email: z
    .string()
    .refine((v) => v.trim() === "" || z.string().email().safeParse(v.trim()).success, {
      message: "Enter a valid email",
    }),
  phone: z.string().max(40),
  address: z.string().max(255),
  city: z.string().max(100),
  country: z.string().max(100),
  notes: z.string(),
  status: z.enum(CUSTOMER_STATUSES),
  source: z.string().max(100),
  /** Assign the signed-in user as owner — never a free-form UUID field. */
  assignMeAsOwner: z.boolean(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
