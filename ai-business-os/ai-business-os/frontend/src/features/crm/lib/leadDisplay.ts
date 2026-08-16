import type { PipelineStage } from "../types";

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

/** Display amount without inventing currency — model has no currency field. */
export function formatLeadValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatLeadDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  // Date-only fields: parse as local calendar date, avoid TZ shift.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function assigneeLabel(
  assignedTo: string | null | undefined,
  currentUserId: string | null,
): string {
  if (!assignedTo) return "Unassigned";
  if (currentUserId && assignedTo === currentUserId) return "You";
  return "Assigned";
}
