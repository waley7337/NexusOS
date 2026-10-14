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
import { leadOptionLabel } from "../hooks/useLeadOptions";
import {
  DEAL_STATUS_LABELS,
  formatDealDateTime,
  formatDealValue,
} from "../lib/dealDisplay";
import { DEAL_STATUSES, type Deal, type DealStatus, type Lead } from "../types";

const STATUS_VARIANT: Record<
  DealStatus,
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  open: "info",
  won: "success",
  lost: "danger",
};

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

interface DealDetailProps {
  deal: Deal | undefined;
  boundLead?: Lead | null;
  customerNameById: Map<string, string>;
  isPending: boolean;
  isError: boolean;
  statusPending?: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onStatusChange: (status: DealStatus) => void;
}

export function DealDetail({
  deal,
  boundLead,
  customerNameById,
  isPending,
  isError,
  statusPending = false,
  onRetry,
  onEdit,
  onArchive,
  onStatusChange,
}: DealDetailProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading deal">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <ErrorState
        title="Deal unavailable"
        description="We couldn't load this deal. It may have been archived."
        onRetry={onRetry}
      />
    );
  }

  const leadText = boundLead
    ? leadOptionLabel(boundLead, customerNameById)
    : "Lead";
  const customerName = boundLead
    ? customerLabel(boundLead.customerId, customerNameById)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-h3 text-foreground">
            {formatDealValue(deal.value, deal.currency)}
          </h3>
          <Badge variant={STATUS_VARIANT[deal.status]}>
            {DEAL_STATUS_LABELS[deal.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="deals.update">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          </Can>
          <Can permission="deals.delete">
            <Button variant="danger" size="sm" onClick={onArchive}>
              Archive
            </Button>
          </Can>
        </div>
      </div>

      <Can permission="deals.update">
        <div className="space-y-1.5">
          <label htmlFor="deal-status-change" className="text-sm font-medium text-foreground">
            Change status
          </label>
          <Select
            id="deal-status-change"
            value={deal.status}
            disabled={statusPending}
            onChange={(e) => onStatusChange(e.target.value as DealStatus)}
            aria-label="Change deal status"
          >
            {DEAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DEAL_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Status updates this deal only. Lead pipeline stage is unchanged.
          </p>
        </div>
      </Can>

      <section aria-labelledby="deal-relationship">
        <h4
          id="deal-relationship"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Relationship
        </h4>
        <dl>
          <DetailRow
            label="Lead"
            value={
              <Link
                to={`${ROUTES.crmLeads}?lead=${deal.leadId}`}
                className="text-primary underline-offset-2 hover:underline focus-ring rounded"
              >
                {leadText}
              </Link>
            }
          />
          {boundLead && customerName ? (
            <DetailRow
              label="Customer"
              value={
                <Link
                  to={`${ROUTES.crmCustomers}?customer=${boundLead.customerId}`}
                  className="text-primary underline-offset-2 hover:underline focus-ring rounded"
                >
                  {customerName}
                </Link>
              }
            />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="deal-commercial">
        <h4
          id="deal-commercial"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Commercial
        </h4>
        <dl>
          <DetailRow label="Value" value={formatDealValue(deal.value, deal.currency)} />
          <DetailRow label="Currency" value={deal.currency} />
          <DetailRow label="Status" value={DEAL_STATUS_LABELS[deal.status]} />
          {deal.status === "won" ? (
            <DetailRow label="Won at" value={formatDealDateTime(deal.wonAt)} />
          ) : null}
          {deal.status === "lost" ? (
            <DetailRow label="Lost reason" value={deal.lostReason} />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="deal-meta">
        <h4
          id="deal-meta"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Record
        </h4>
        <dl>
          <DetailRow label="Created" value={formatDealDateTime(deal.createdAt)} />
          <DetailRow label="Updated" value={formatDealDateTime(deal.updatedAt)} />
        </dl>
      </section>
    </div>
  );
}
