import type { DealStatus } from "../types";

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

export function formatDealValue(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  const amount = Number.isNaN(n)
    ? String(value)
    : new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(n);
  const code = currency?.trim().toUpperCase();
  return code ? `${amount} ${code}` : amount;
}

export function formatDealDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDealDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
