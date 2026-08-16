import type { Lead } from "../types";
import type { LeadFormValues } from "../schemas/leadSchema";

export function leadToFormValues(
  lead: Lead | null | undefined,
  currentUserId: string | null,
): LeadFormValues {
  if (!lead) {
    return {
      customerId: "",
      pipelineStage: "new",
      estimatedValue: "",
      probability: "",
      expectedCloseDate: "",
      assigneeMode: "unassigned",
      notes: "",
    };
  }
  return {
    customerId: lead.customerId,
    pipelineStage: lead.pipelineStage,
    estimatedValue:
      lead.estimatedValue == null || lead.estimatedValue === ""
        ? ""
        : String(lead.estimatedValue),
    probability: lead.probability == null ? "" : String(lead.probability),
    expectedCloseDate: lead.expectedCloseDate ?? "",
    assigneeMode: !lead.assignedTo
      ? "unassigned"
      : currentUserId && lead.assignedTo === currentUserId
        ? "me"
        : "other",
    notes: lead.notes ?? "",
  };
}
