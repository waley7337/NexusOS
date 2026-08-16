import type { Deal } from "../types";
import type { DealFormValues } from "../schemas/dealSchema";

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function dealToFormValues(deal: Deal | null | undefined): DealFormValues {
  if (!deal) {
    return {
      leadId: "",
      value: "",
      currency: "USD",
      status: "open",
      wonAt: "",
      lostReason: "",
    };
  }
  return {
    leadId: deal.leadId,
    value: String(deal.value),
    currency: deal.currency,
    status: deal.status,
    wonAt: toDatetimeLocal(deal.wonAt),
    lostReason: deal.lostReason ?? "",
  };
}

/** Convert datetime-local value to ISO string for API, or null if empty. */
export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
