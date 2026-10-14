import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/can";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  EMPLOYMENT_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  formatDate,
  formatDateTime,
  managerLabel,
} from "../lib/employeeDisplay";
import { employeeIncludesCompensation, type Employee } from "../types";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line-soft py-2.5 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 wrap-break-word text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

interface EmployeeDetailProps {
  employee: Employee | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  managerLookup?: Map<string, Employee>;
}

export function EmployeeDetail({
  employee,
  isPending,
  isError,
  onRetry,
  onEdit,
  onArchive,
  managerLookup = new Map(),
}: EmployeeDetailProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading employee">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <ErrorState
        title="Employee not found"
        description="We couldn't load this employment record. It may have been archived or you may not have access."
        onRetry={onRetry}
      />
    );
  }

  const showCompensation = employeeIncludesCompensation(employee);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-h3 text-foreground">{employee.fullName}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[employee.status]}>
              {STATUS_LABEL[employee.status]}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {employee.employeeNumber}
            </span>
          </div>
        </div>
        {(onEdit || onArchive) && (
          <div className="flex flex-wrap gap-2">
            <Can permission="employees.update">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
            </Can>
            <Can permission="employees.delete">
              {onArchive && (
                <Button variant="danger" size="sm" onClick={onArchive}>
                  Archive
                </Button>
              )}
            </Can>
          </div>
        )}
      </div>

      <section aria-labelledby="employee-identity">
        <h4
          id="employee-identity"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Identity
        </h4>
        <dl>
          <DetailRow label="First name" value={employee.firstName} />
          <DetailRow label="Last name" value={employee.lastName} />
          <DetailRow label="Work email" value={employee.workEmail} />
        </dl>
      </section>

      <section aria-labelledby="employee-employment">
        <h4
          id="employee-employment"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Employment
        </h4>
        <dl>
          <DetailRow label="Type" value={EMPLOYMENT_LABEL[employee.employmentType]} />
          <DetailRow label="Status" value={STATUS_LABEL[employee.status]} />
          <DetailRow label="Hire date" value={formatDate(employee.hireDate)} />
          <DetailRow label="Department" value={employee.department} />
        </dl>
      </section>

      <section aria-labelledby="employee-organization">
        <h4
          id="employee-organization"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Organization
        </h4>
        <dl>
          <DetailRow
            label="Manager"
            value={managerLabel(employee.managerId, managerLookup)}
          />
        </dl>
      </section>

      <section aria-labelledby="employee-account">
        <h4
          id="employee-account"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Account link
        </h4>
        <dl>
          <DetailRow
            label="NexusOS user"
            value={employee.userId ? "Linked login account" : "No login (HR-only)"}
          />
        </dl>
      </section>

      {showCompensation && (
        <section aria-labelledby="employee-compensation">
          <h4
            id="employee-compensation"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Compensation
          </h4>
          <dl>
            <DetailRow label="Salary grade" value={employee.salaryGrade ?? "—"} />
          </dl>
        </section>
      )}

      <section aria-labelledby="employee-meta">
        <h4
          id="employee-meta"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Record
        </h4>
        <dl>
          <DetailRow label="Created" value={formatDateTime(employee.createdAt)} />
          <DetailRow label="Updated" value={formatDateTime(employee.updatedAt)} />
        </dl>
      </section>
    </div>
  );
}
