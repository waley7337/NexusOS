import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Customer, CustomerSortField, CustomerStatus } from "../types";

const STATUS_VARIANT: Record<
  CustomerStatus,
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  lead: "info",
  active: "success",
  inactive: "default",
  churned: "warning",
};

const STATUS_LABEL: Record<CustomerStatus, string> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
};

function formatDate(iso: string): string {
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

interface CustomersTableProps {
  customers: Customer[];
  sortBy: CustomerSortField;
  sortDesc: boolean;
  onSort: (field: CustomerSortField) => void;
  onRowClick: (customer: Customer) => void;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDesc,
  onSort,
}: {
  label: string;
  field: CustomerSortField;
  sortBy: CustomerSortField;
  sortDesc: boolean;
  onSort: (field: CustomerSortField) => void;
}) {
  const active = sortBy === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded transition-colors duration-fast hover:text-foreground focus-ring"
      onClick={() => onSort(field)}
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

export function CustomersTable({
  customers,
  sortBy,
  sortDesc,
  onSort,
  onRowClick,
}: CustomersTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80">
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Company"
                field="company_name"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
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
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
              Industry
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
              Email
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
              City
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
          {customers.map((customer) => (
            <tr
              key={customer.id}
              className={cn(
                "cursor-pointer border-b border-line-soft transition-colors duration-fast last:border-0 hover:bg-surface-3/60",
              )}
              onClick={() => onRowClick(customer)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(customer);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`Open ${customer.companyName}`}
            >
              <td className="px-4 py-3 font-medium text-foreground">{customer.companyName}</td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[customer.status]}>
                  {STATUS_LABEL[customer.status]}
                </Badge>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                {customer.industry ?? "—"}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                {customer.email ?? "—"}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {customer.city ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground tabular-nums">
                {formatDate(customer.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
