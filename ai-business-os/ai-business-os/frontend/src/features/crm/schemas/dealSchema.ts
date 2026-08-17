import { z } from "zod";
import { DEAL_STATUSES } from "../types";

export const dealFormSchema = z.object({
  leadId: z.string().uuid("Select a lead"),
  value: z
    .string()
    .trim()
    .min(1, "Value is required")
    .superRefine((v, ctx) => {
      const n = Number(v);
      if (Number.isNaN(n)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
        return;
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "Value must be zero or greater" });
      }
    }),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code"),
  status: z.enum(DEAL_STATUSES),
  // Optional; backend does not require these when status changes.
  wonAt: z.string(),
  lostReason: z.string(),
});

export type DealFormValues = z.infer<typeof dealFormSchema>;

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}
