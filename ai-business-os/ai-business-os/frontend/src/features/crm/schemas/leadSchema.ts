import { z } from "zod";
import { PIPELINE_STAGES } from "../types";

export const leadFormSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  pipelineStage: z.enum(PIPELINE_STAGES),
  estimatedValue: z
    .string()
    .superRefine((v, ctx) => {
      const trimmed = v.trim();
      if (trimmed === "") return;
      const n = Number(trimmed);
      if (Number.isNaN(n)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
        return;
      }
      if (n < 0) {
        ctx.addIssue({ code: "custom", message: "Amount must be zero or greater" });
      }
    }),
  probability: z
    .string()
    .refine(
      (v) => {
        if (v.trim() === "") return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= 100;
      },
      { message: "Probability must be 0–100" },
    ),
  expectedCloseDate: z.string(),
  /** Assignment without a members API: unassigned | me | preserve other. */
  assigneeMode: z.enum(["unassigned", "me", "other"]),
  notes: z.string(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function emptyToNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return Number(trimmed);
}
