import { z } from "zod";
import { PIPELINE_STAGES } from "../types";

export const leadFormSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  pipelineStage: z.enum(PIPELINE_STAGES),
  estimatedValue: z
    .string()
    .refine(
      (v) => v.trim() === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      { message: "Enter a valid amount" },
    ),
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
