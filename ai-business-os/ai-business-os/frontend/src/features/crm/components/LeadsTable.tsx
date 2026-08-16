import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { customerLabel } from "../hooks/useCustomerOptions";
import {
  PIPELINE_STAGE_LABELS,
  assigneeLabel,
  formatLeadDate,
  formatLeadValue,
} from "../lib/leadDisplay";
import type { Lead, LeadSortField, PipelineStage } from "../types";

const STAGE_VARIANT: Record<
  PipelineStage,
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  new: "info",
  qualified: "accent",
  proposal: "default",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

interface LeadsTableProps {
  leads: Lead[];
  nameById: Map<string, string>;
  currentUserId: string | null;
  sortBy: LeadSortField;
  sortDesc: boolean;
  onSort: (field: LeadSortField) => void;
  onRowClick: (lead: Lead) => void;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDesc,
  onSort,
}: {
  label: string;
  field: LeadSortField;
  sortBy: LeadSortField;
  sortDesc: boolean;
  onSort: (field: LeadSortField) => void;
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

export function LeadsTable({
  leads,
  nameById,
  currentUserId,
  sortBy,
  sortDesc,
  onSort,
  onRowClick,
}: LeadsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80">
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Stage"
                field="pipeline_stage"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
              <SortHeader
                label="Value"
                field="estimated_value"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
              <SortHeader
                label="Expected close"
                field="expected_close_date"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
              Assigned
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
          {leads.map((lead) => {
            const customerName = customerLabel(lead.customerId, nameById);
            return (
              <tr
                key={lead.id}
                className={cn(
                  "cursor-pointer border-b border-line-soft transition-colors duration-fast last:border-0 hover:bg-surface-3/60",
                )}
                onClick={() => onRowClick(lead)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(lead);
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open lead for ${customerName}`}
              >
                <td className="px-4 py-3 font-medium text-foreground">{customerName}</td>
                <td className="px-4 py-3">
                  <Badge variant={STAGE_VARIANT[lead.pipelineStage]}>
                    {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                  </Badge>
                </td>
                <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                  {formatLeadValue(lead.estimatedValue)}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {formatLeadDate(lead.expectedCloseDate)}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {assigneeLabel(lead.assignedTo, currentUserId)}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatLeadDate(lead.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
