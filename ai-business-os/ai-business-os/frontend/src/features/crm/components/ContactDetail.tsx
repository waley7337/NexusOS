import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/can";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ROUTES } from "@/constants/routes";
import { customerLabel } from "../hooks/useCustomerOptions";
import type { Contact, Customer } from "../types";

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

interface ContactDetailProps {
  contact: Contact | undefined;
  nameById: Map<string, string>;
  resolvedCustomer?: Customer | null;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function ContactDetail({
  contact,
  nameById,
  resolvedCustomer,
  isPending,
  isError,
  onRetry,
  onEdit,
  onArchive,
}: ContactDetailProps) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading contact">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError || !contact) {
    return (
      <ErrorState
        title="Contact unavailable"
        description="We couldn't load this contact. It may have been archived."
        onRetry={onRetry}
      />
    );
  }

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const customerName = customerLabel(contact.customerId, nameById, resolvedCustomer);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-h3 text-foreground">{fullName}</h3>
          {contact.position && (
            <p className="text-sm text-muted-foreground">{contact.position}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Can permission="contacts.update">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          </Can>
          <Can permission="contacts.delete">
            <Button variant="danger" size="sm" onClick={onArchive}>
              Archive
            </Button>
          </Can>
        </div>
      </div>

      <section aria-labelledby="contact-customer">
        <h4
          id="contact-customer"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Customer
        </h4>
        <dl>
          <DetailRow
            label="Account"
            value={
              <Link
                to={`${ROUTES.crmCustomers}?customer=${contact.customerId}`}
                className="text-primary underline-offset-2 hover:underline focus-ring rounded"
              >
                {customerName}
              </Link>
            }
          />
        </dl>
      </section>

      <section aria-labelledby="contact-info">
        <h4
          id="contact-info"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Contact
        </h4>
        <dl>
          <DetailRow label="Email" value={contact.email} />
          <DetailRow label="Phone" value={contact.phone} />
          <DetailRow label="LinkedIn" value={contact.linkedin} />
        </dl>
      </section>

      {contact.notes && (
        <section aria-labelledby="contact-notes">
          <h4
            id="contact-notes"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Notes
          </h4>
          <p className="whitespace-pre-wrap text-sm text-foreground">{contact.notes}</p>
        </section>
      )}

      <section aria-labelledby="contact-meta">
        <h4
          id="contact-meta"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Record
        </h4>
        <dl>
          <DetailRow label="Created" value={formatDateTime(contact.createdAt)} />
          <DetailRow label="Updated" value={formatDateTime(contact.updatedAt)} />
        </dl>
      </section>
    </div>
  );
}
