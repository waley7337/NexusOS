import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/can";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { customerLabel } from "../hooks/useCustomerOptions";
import {
  PIPELINE_STAGE_LABELS,
  assigneeLabel,
  formatLeadDate,
  formatLeadValue,
} from "../lib/leadDisplay";
import { PIPELINE_STAGES, type Customer, type Lead, type PipelineStage } from "../types";

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

function formatDateTime(iso: string): string {
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line-soft py-2.5 last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

interface LeadDetailProps {
  lead: Lead | undefined;
  nameById: Map<string, string>;
  resolvedCustomer?: Customer | null;
  currentUserId: string | null;
  isPending: boolean;
  isError: boolean;
  stagePending?: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onStageChange: (stage: PipelineStage) => void;
}

export function LeadDetail({
  lead,
  nameById,
  resolvedCustomer,
  currentUserId,
  isPending,
  isError,
  stagePending = false,
  onRetry,
  onEdit,
  onArchive,
  onStageChange,
}: LeadDetailProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading lead">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <ErrorState
        title="Lead unavailable"
        description="We couldn't load this lead. It may have been archived."
        onRetry={onRetry}
      />
    );
  }

  const customerName = customerLabel(lead.customerId, nameById, resolvedCustomer);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-h3 text-foreground">{customerName}</h3>
          <Badge variant={STAGE_VARIANT[lead.pipelineStage]}>
            {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="leads.update">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          </Can>
          <Can permission="leads.delete">
            <Button variant="danger" size="sm" onClick={onArchive}>
              Archive
            </Button>
          </Can>
        </div>
      </div>

      <Can permission="leads.update">
        <div className="space-y-1.5">
          <label htmlFor="lead-stage-change" className="text-sm font-medium text-foreground">
            Change stage
          </label>
          <Select
            id="lead-stage-change"
            value={lead.pipelineStage}
            disabled={stagePending}
            onChange={(e) => onStageChange(e.target.value as PipelineStage)}
            aria-label="Change pipeline stage"
          >
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {PIPELINE_STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Stages update immediately. Won/lost do not create deals yet.
          </p>
        </div>
      </Can>

      <section aria-labelledby="lead-customer">
        <h4
          id="lead-customer"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Customer
        </h4>
        <dl>
          <DetailRow
            label="Account"
            value={
              <Link
                to={`${ROUTES.crmCustomers}?customer=${lead.customerId}`}
                className="text-primary underline-offset-2 hover:underline focus-ring rounded"
              >
                {customerName}
              </Link>
            }
          />
        </dl>
      </section>

      <section aria-labelledby="lead-opportunity">
        <h4
          id="lead-opportunity"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Opportunity
        </h4>
        <dl>
          <DetailRow label="Value" value={formatLeadValue(lead.estimatedValue)} />
          <DetailRow
            label="Probability"
            value={lead.probability == null ? "—" : `${lead.probability}%`}
          />
          <DetailRow label="Close" value={formatLeadDate(lead.expectedCloseDate)} />
          <DetailRow
            label="Assigned"
            value={assigneeLabel(lead.assignedTo, currentUserId)}
          />
        </dl>
      </section>

      {lead.notes && (
        <section aria-labelledby="lead-notes">
          <h4
            id="lead-notes"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Notes
          </h4>
          <p className="whitespace-pre-wrap text-sm text-foreground">{lead.notes}</p>
        </section>
      )}

      <section aria-labelledby="lead-meta">
        <h4
          id="lead-meta"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Record
        </h4>
        <dl>
          <DetailRow label="Created" value={formatDateTime(lead.createdAt)} />
          <DetailRow label="Updated" value={formatDateTime(lead.updatedAt)} />
        </dl>
      </section>
    </div>
  );
}
