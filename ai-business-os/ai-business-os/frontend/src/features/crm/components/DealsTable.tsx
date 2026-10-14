import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { leadLabel } from "../hooks/useLeadOptions";
import { customerLabel } from "../hooks/useCustomerOptions";
import {
  DEAL_STATUS_LABELS,
  formatDealDate,
  formatDealValue,
} from "../lib/dealDisplay";
import type { Deal, DealSortField, DealStatus, Lead } from "../types";

const STATUS_VARIANT: Record<
  DealStatus,
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  open: "info",
  won: "success",
  lost: "danger",
};

interface DealsTableProps {
  deals: Deal[];
  leadById: Map<string, Lead>;
  customerNameById: Map<string, string>;
  sortBy: DealSortField;
  sortDesc: boolean;
  onSort: (field: DealSortField) => void;
  onRowClick: (deal: Deal) => void;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDesc,
  onSort,
}: {
  label: string;
  field: DealSortField;
  sortBy: DealSortField;
  sortDesc: boolean;
  onSort: (field: DealSortField) => void;
}) {
  const active = sortBy === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded transition-colors duration-fast hover:text-foreground focus-ring"
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}${active ? (sortDesc ? ", descending" : ", ascending") : ""}`}
      aria-sort={active ? (sortDesc ? "descending" : "ascending") : undefined}
    >
      {label}
      {active ? (
        sortDesc ? (
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

function outcomeLabel(deal: Deal): string {
  if (deal.status === "won") {
    return deal.wonAt ? `Won ${formatDealDate(deal.wonAt)}` : "Won";
  }
  if (deal.status === "lost") {
    const reason = deal.lostReason?.trim();
    if (reason) {
      return reason.length > 48 ? `${reason.slice(0, 48)}…` : reason;
    }
    return "Lost";
  }
  return "—";
}

export function DealsTable({
  deals,
  leadById,
  customerNameById,
  sortBy,
  sortDesc,
  onSort,
  onRowClick,
}: DealsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80">
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Lead
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
              Customer
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Status"
                field="status"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Value"
                field="value"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
              Outcome
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Created"
                field="created_at"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const lead = leadById.get(deal.leadId);
            const leadText = leadLabel(deal.leadId, leadById, customerNameById);
            const customerText = lead
              ? customerLabel(lead.customerId, customerNameById)
              : "—";
            return (
              <tr
                key={deal.id}
                className={cn(
                  "cursor-pointer border-b border-line-soft last:border-0",
                  "transition-colors duration-fast hover:bg-surface-3/60",
                )}
                onClick={() => onRowClick(deal)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(deal);
                  }
                }}
                tabIndex={0}
                role="row"
                aria-label={`Open deal ${leadText}`}
              >
                <td className="px-4 py-3 font-medium text-foreground">{leadText}</td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {customerText}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[deal.status]}>
                    {DEAL_STATUS_LABELS[deal.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {formatDealValue(deal.value, deal.currency)}
                </td>
                <td className="hidden max-w-56 truncate px-4 py-3 text-muted-foreground md:table-cell">
                  {outcomeLabel(deal)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDealDate(deal.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
