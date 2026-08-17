import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  EMPLOYMENT_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  formatDate,
  managerLabel,
} from "../lib/employeeDisplay";
import type { Employee, EmployeeSortField } from "../types";

interface EmployeesTableProps {
  employees: Employee[];
  sortBy: EmployeeSortField;
  sortDesc: boolean;
  onSort: (field: EmployeeSortField) => void;
  onRowClick: (employee: Employee) => void;
  managerLookup: Map<string, Employee>;
  compact?: boolean;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDesc,
  onSort,
}: {
  label: string;
  field: EmployeeSortField;
  sortBy: EmployeeSortField;
  sortDesc: boolean;
  onSort: (field: EmployeeSortField) => void;
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

export function EmployeesTable({
  employees,
  sortBy,
  sortDesc,
  onSort,
  onRowClick,
  managerLookup,
  compact = false,
}: EmployeesTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80">
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Employee"
                field="last_name"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Employee #"
                field="employee_number"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            {!compact && (
              <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                Department
              </th>
            )}
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
              Type
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
            {!compact && (
              <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
                Manager
              </th>
            )}
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
              Hire date
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr
              key={employee.id}
              className={cn(
                "cursor-pointer border-b border-line-soft transition-colors duration-fast last:border-0 hover:bg-surface-3/60",
              )}
              onClick={() => onRowClick(employee)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(employee);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`Open ${employee.fullName}`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{employee.fullName}</div>
                {employee.workEmail && (
                  <div className="text-2xs text-muted-foreground">{employee.workEmail}</div>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {employee.employeeNumber}
              </td>
              {!compact && (
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {employee.department ?? "—"}
                </td>
              )}
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {EMPLOYMENT_LABEL[employee.employmentType]}
              </td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[employee.status]}>
                  {STATUS_LABEL[employee.status]}
                </Badge>
              </td>
              {!compact && (
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {managerLabel(employee.managerId, managerLookup)}
                </td>
              )}
              <td className="hidden px-4 py-3 text-muted-foreground tabular-nums lg:table-cell">
                {formatDate(employee.hireDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
