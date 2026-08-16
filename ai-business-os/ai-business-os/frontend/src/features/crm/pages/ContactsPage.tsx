/**
 * Contacts workspace — second operational CRM UI (Part 06.5).
 *
 * Customer names/picker: one bounded Customers list (≤100), never N+1
 * detail fetches per table row. Contact detail may resolve one missing
 * customer via useCustomer when needed.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, UserRound } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { Can } from "@/components/can";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { ROUTES } from "@/constants/routes";
import { ContactDetail } from "@/features/crm/components/ContactDetail";
import { ContactForm } from "@/features/crm/components/ContactForm";
import { ContactsTable } from "@/features/crm/components/ContactsTable";
import { CrmSubnav } from "@/features/crm/components/CrmSubnav";
import type { ContactFormValues } from "@/features/crm/schemas/contactSchema";
import { emptyToNull } from "@/features/crm/schemas/contactSchema";
import {
  useArchiveContact,
  useContact,
  useContacts,
  useCreateContact,
  useUpdateContact,
} from "@/features/crm/hooks/useContacts";
import { useCustomer } from "@/features/crm/hooks/useCustomers";
import { useCustomerOptions } from "@/features/crm/hooks/useCustomerOptions";
import {
  CONTACT_SORT_FIELDS,
  type Contact,
  type ContactCreatePayload,
  type ContactSortField,
} from "@/features/crm/types";

const DEFAULT_PAGE_SIZE = 20;

function parseSortBy(value: string | null): ContactSortField {
  if (value && (CONTACT_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as ContactSortField;
  }
  return "created_at";
}

function toPayload(values: ContactFormValues): ContactCreatePayload {
  return {
    customerId: values.customerId,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    position: emptyToNull(values.position),
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    linkedin: emptyToNull(values.linkedin),
    notes: emptyToNull(values.notes),
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

export function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreate = usePermission("contacts.create");
  const canReadCustomers = usePermission("customers.read");

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    ),
  );
  const searchInput = searchParams.get("search") ?? "";
  const customerFilter = searchParams.get("customerId") ?? "";
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDesc = searchParams.get("sortDesc") !== "false";
  const contactId = searchParams.get("contact");

  const debouncedSearch = useDebounce(searchInput, 300);

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      customerId: customerFilter || undefined,
      sortBy,
      sortDesc,
    }),
    [page, pageSize, debouncedSearch, customerFilter, sortBy, sortDesc],
  );

  const listQuery = useContacts(listParams);
  const detailQuery = useContact(contactId);
  const optionsQuery = useCustomerOptions(canReadCustomers || canCreate);
  const missingCustomerId =
    detailQuery.data && !optionsQuery.nameById.has(detailQuery.data.customerId)
      ? detailQuery.data.customerId
      : null;
  const missingCustomerQuery = useCustomer(missingCustomerId);

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const archiveMutation = useArchiveContact();

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const patchParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value == null || value === "") next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const openContact = (contact: Contact) => {
    patchParams({ contact: contact.id });
  };

  const closeContact = () => {
    patchParams({ contact: null });
    setFormMode(null);
    setArchiveOpen(false);
  };

  const handleSort = (field: ContactSortField) => {
    if (sortBy === field) {
      patchParams({ sortDesc: sortDesc ? "false" : "true" });
    } else {
      patchParams({
        sortBy: field,
        sortDesc: field === "created_at" ? "true" : "false",
      });
    }
  };

  const handleCreate = async (values: ContactFormValues) => {
    try {
      const created = await createMutation.mutateAsync(toPayload(values));
      toast.success("Contact created");
      setFormMode(null);
      patchParams({ contact: created.id, page: "1" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not create contact."));
    }
  };

  const handleUpdate = async (values: ContactFormValues) => {
    if (!contactId) return;
    try {
      await updateMutation.mutateAsync({
        id: contactId,
        payload: toPayload(values),
      });
      toast.success("Contact updated");
      setFormMode(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update contact."));
    }
  };

  const handleArchive = async () => {
    if (!contactId) return;
    try {
      await archiveMutation.mutateAsync(contactId);
      toast.success("Contact archived");
      setArchiveOpen(false);
      closeContact();
    } catch (err) {
      toast.error(errorMessage(err, "Could not archive contact."));
    }
  };

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const customerCount = optionsQuery.total;
  const hasCustomers = customerCount > 0;

  const showEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    total === 0 &&
    !debouncedSearch.trim() &&
    !customerFilter;
  const showFilteredEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    items.length === 0 &&
    (Boolean(debouncedSearch.trim()) || Boolean(customerFilter));

  const openCreate = () => {
    if (!hasCustomers) return;
    setFormMode("create");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="People associated with your customer accounts"
        actions={
          <Can permission="contacts.create">
            <Button onClick={openCreate} disabled={!hasCustomers && !optionsQuery.isPending}>
              <Plus /> New contact
            </Button>
          </Can>
        }
      />

      <CrmSubnav />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => patchParams({ search: e.target.value }, true)}
            placeholder="Search contacts…"
            aria-label="Search contacts"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by customer"
          value={customerFilter}
          onChange={(e) => patchParams({ customerId: e.target.value || null }, true)}
          className="min-w-44 max-w-xs"
        >
          <option value="">All customers</option>
          {optionsQuery.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </div>

      {listQuery.isPending && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading contacts">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {listQuery.isError && (
        <ErrorState
          title="Contacts couldn't load"
          description="Check your connection and try again."
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {showEmpty && !hasCustomers && !optionsQuery.isPending && (
        <EmptyState
          icon={UserRound}
          status="No customers"
          title="Create a customer first"
          description="Contacts are people associated with customer accounts. Add a customer before creating contacts."
          actionLabel="Go to Customers"
          onAction={() => navigate(ROUTES.crmCustomers)}
        />
      )}

      {showEmpty && hasCustomers && (
        <EmptyState
          icon={UserRound}
          status="No contacts"
          title="No contacts yet"
          description="Contacts are people associated with your customer accounts."
          actionLabel={canCreate ? "Add contact" : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      )}

      {showFilteredEmpty && (
        <EmptyState
          icon={Search}
          status="No matches"
          title="No contacts match"
          description="Try a different search or clear the customer filter."
        />
      )}

      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="space-y-3">
          <ContactsTable
            contacts={items}
            nameById={optionsQuery.nameById}
            sortBy={sortBy}
            sortDesc={sortDesc}
            onSort={handleSort}
            onRowClick={openContact}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} contact{total === 1 ? "" : "s"}
              {meta ? ` · page ${meta.page} of ${meta.totalPages}` : null}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => patchParams({ page: String(p) })}
            />
          </div>
        </div>
      )}

      <Drawer
        open={Boolean(contactId) && formMode !== "edit"}
        onOpenChange={(open) => {
          if (!open) closeContact();
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader title="Contact" description="Person linked to a customer account" />
          <DrawerBody>
            <ContactDetail
              contact={detailQuery.data}
              nameById={optionsQuery.nameById}
              resolvedCustomer={missingCustomerQuery.data}
              isPending={detailQuery.isPending}
              isError={detailQuery.isError}
              onRetry={() => void detailQuery.refetch()}
              onEdit={() => setFormMode("edit")}
              onArchive={() => setArchiveOpen(true)}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) setFormMode(null);
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title={formMode === "edit" ? "Edit contact" : "New contact"}
            description={
              formMode === "edit"
                ? "Update this person"
                : "Add a person linked to a customer account"
            }
          />
          <DrawerBody>
            {optionsQuery.truncated && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing the first {optionsQuery.customers.length} customers in the
                picker. Use search on Customers if you need another account.
              </p>
            )}
            <ContactForm
              initial={formMode === "edit" ? detailQuery.data : null}
              customers={optionsQuery.customers}
              submitLabel={formMode === "edit" ? "Save changes" : "Create contact"}
              pending={createMutation.isPending || updateMutation.isPending}
              onCancel={() => setFormMode(null)}
              onSubmit={formMode === "edit" ? handleUpdate : handleCreate}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive contact?"
        description="This contact will be archived and removed from the active list."
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}
