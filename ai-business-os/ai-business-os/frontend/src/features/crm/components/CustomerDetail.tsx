import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Can } from "@/components/can";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Customer, CustomerStatus } from "../types";

const STATUS_LABEL: Record<CustomerStatus, string> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
};

const STATUS_VARIANT: Record<
  CustomerStatus,
  "default" | "accent" | "success" | "warning" | "danger" | "info"
> = {
  lead: "info",
  active: "success",
  inactive: "default",
  churned: "warning",
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

interface CustomerDetailProps {
  customer: Customer | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function CustomerDetail({
  customer,
  isPending,
  isError,
  onRetry,
  onEdit,
  onArchive,
}: CustomerDetailProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading customer">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <ErrorState
        title="Customer unavailable"
        description="We couldn't load this customer. It may have been archived."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-h3 text-foreground">{customer.companyName}</h3>
          <Badge variant={STATUS_VARIANT[customer.status]}>
            {STATUS_LABEL[customer.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="contacts.read">
            <Link
              to={`${ROUTES.crmContacts}?customerId=${customer.id}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              View contacts
            </Link>
          </Can>
          <Can permission="customers.update">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          </Can>
          <Can permission="customers.delete">
            <Button variant="danger" size="sm" onClick={onArchive}>
              Archive
            </Button>
          </Can>
        </div>
      </div>

      <section aria-labelledby="customer-identity">
        <h4 id="customer-identity" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h4>
        <dl>
          <DetailRow label="Company" value={customer.companyName} />
          <DetailRow label="Status" value={STATUS_LABEL[customer.status]} />
          <DetailRow label="Industry" value={customer.industry} />
          <DetailRow label="Source" value={customer.source} />
        </dl>
      </section>

      <section aria-labelledby="customer-contact">
        <h4 id="customer-contact" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contact
        </h4>
        <dl>
          <DetailRow label="Email" value={customer.email} />
          <DetailRow label="Phone" value={customer.phone} />
          <DetailRow label="Website" value={customer.website} />
        </dl>
      </section>

      <section aria-labelledby="customer-address">
        <h4 id="customer-address" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Address
        </h4>
        <dl>
          <DetailRow label="Street" value={customer.address} />
          <DetailRow label="City" value={customer.city} />
          <DetailRow label="Country" value={customer.country} />
        </dl>
      </section>

      {customer.notes && (
        <section aria-labelledby="customer-notes">
          <h4 id="customer-notes" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h4>
          <p className="whitespace-pre-wrap text-sm text-foreground">{customer.notes}</p>
        </section>
      )}

      <section aria-labelledby="customer-meta">
        <h4 id="customer-meta" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Record
        </h4>
        <dl>
          <DetailRow label="Created" value={formatDateTime(customer.createdAt)} />
          <DetailRow label="Updated" value={formatDateTime(customer.updatedAt)} />
          <DetailRow
            label="Owner"
            value={customer.ownerId ? "Assigned" : "Unassigned"}
          />
        </dl>
      </section>
    </div>
  );
}
