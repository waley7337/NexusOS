import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { customerLabel } from "../hooks/useCustomerOptions";
import type { Contact, ContactSortField } from "../types";

interface ContactsTableProps {
  contacts: Contact[];
  nameById: Map<string, string>;
  sortBy: ContactSortField;
  sortDesc: boolean;
  onSort: (field: ContactSortField) => void;
  onRowClick: (contact: Contact) => void;
}

function SortHeader({
  label,
  field,
  sortBy,
  sortDesc,
  onSort,
}: {
  label: string;
  field: ContactSortField;
  sortBy: ContactSortField;
  sortDesc: boolean;
  onSort: (field: ContactSortField) => void;
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

export function ContactsTable({
  contacts,
  nameById,
  sortBy,
  sortDesc,
  onSort,
  onRowClick,
}: ContactsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80">
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <SortHeader
                label="Name"
                field="last_name"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
              Position
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
              Email
            </th>
            <th className="hidden px-4 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
              Phone
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
          {contacts.map((contact) => {
            const name = `${contact.firstName} ${contact.lastName}`.trim();
            return (
              <tr
                key={contact.id}
                className={cn(
                  "cursor-pointer border-b border-line-soft transition-colors duration-fast last:border-0 hover:bg-surface-3/60",
                )}
                onClick={() => onRowClick(contact)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(contact);
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${name}`}
              >
                <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {customerLabel(contact.customerId, nameById)}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {contact.position ?? "—"}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {contact.email ?? "—"}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {contact.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDate(contact.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
