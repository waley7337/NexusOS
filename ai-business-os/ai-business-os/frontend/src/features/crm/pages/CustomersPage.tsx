/**
 * Customers workspace — first operational CRM UI (Part 06.3).
 *
 * Server-driven list (search / status / sort / pagination). Owner filter
 * omitted: no tenant users list API yet. Owner assignment is limited to
 * "assign me" via the signed-in user id.
 */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
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
import { useAuthStore } from "@/stores/auth";
import { CustomerDetail } from "@/features/crm/components/CustomerDetail";
import { CustomerForm } from "@/features/crm/components/CustomerForm";
import { CustomersTable } from "@/features/crm/components/CustomersTable";
import type { CustomerFormValues } from "@/features/crm/schemas/customerSchema";
import { emptyToNull } from "@/features/crm/schemas/customerSchema";
import {
  useArchiveCustomer,
  useCreateCustomer,
  useCustomer,
  useCustomers,
  useUpdateCustomer,
} from "@/features/crm/hooks/useCustomers";
import {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerCreatePayload,
  type CustomerSortField,
  type CustomerStatus,
} from "@/features/crm/types";

const DEFAULT_PAGE_SIZE = 20;

function parseSortBy(value: string | null): CustomerSortField {
  if (value && (CUSTOMER_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as CustomerSortField;
  }
  return "created_at";
}

function parseStatus(value: string | null): CustomerStatus | undefined {
  if (value && (CUSTOMER_STATUSES as readonly string[]).includes(value)) {
    return value as CustomerStatus;
  }
  return undefined;
}

function toPayload(
  values: CustomerFormValues,
  currentUserId: string | null,
): CustomerCreatePayload {
  return {
    companyName: values.companyName.trim(),
    industry: emptyToNull(values.industry),
    website: emptyToNull(values.website),
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    address: emptyToNull(values.address),
    city: emptyToNull(values.city),
    country: emptyToNull(values.country),
    notes: emptyToNull(values.notes),
    status: values.status,
    source: emptyToNull(values.source),
    ownerId: values.assignMeAsOwner && currentUserId ? currentUserId : null,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

export function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const canCreate = usePermission("customers.create");

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  );
  const searchInput = searchParams.get("search") ?? "";
  const status = parseStatus(searchParams.get("status"));
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDesc = searchParams.get("sortDesc") !== "false";
  const customerId = searchParams.get("customer");

  const debouncedSearch = useDebounce(searchInput, 300);

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      status,
      sortBy,
      sortDesc,
    }),
    [page, pageSize, debouncedSearch, status, sortBy, sortDesc],
  );

  const listQuery = useCustomers(listParams);
  const detailQuery = useCustomer(customerId);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const archiveMutation = useArchiveCustomer();

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

  const openCustomer = (customer: Customer) => {
    patchParams({ customer: customer.id });
  };

  const closeCustomer = () => {
    patchParams({ customer: null });
    setFormMode(null);
    setArchiveOpen(false);
  };

  const handleSort = (field: CustomerSortField) => {
    if (sortBy === field) {
      patchParams({ sortDesc: sortDesc ? "false" : "true" });
    } else {
      patchParams({ sortBy: field, sortDesc: field === "company_name" ? "false" : "true" });
    }
  };

  const handleCreate = async (values: CustomerFormValues) => {
    try {
      const created = await createMutation.mutateAsync(toPayload(values, currentUserId));
      toast.success("Customer created");
      setFormMode(null);
      patchParams({ customer: created.id, page: "1" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not create customer."));
    }
  };

  const handleUpdate = async (values: CustomerFormValues) => {
    if (!customerId) return;
    try {
      await updateMutation.mutateAsync({
        id: customerId,
        payload: toPayload(values, currentUserId),
      });
      toast.success("Customer updated");
      setFormMode(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update customer."));
    }
  };

  const handleArchive = async () => {
    if (!customerId) return;
    try {
      await archiveMutation.mutateAsync(customerId);
      toast.success("Customer archived");
      setArchiveOpen(false);
      closeCustomer();
    } catch (err) {
      toast.error(errorMessage(err, "Could not archive customer."));
    }
  };

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const showEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    total === 0 &&
    !debouncedSearch.trim() &&
    !status;
  const showFilteredEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    items.length === 0 &&
    (Boolean(debouncedSearch.trim()) || Boolean(status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Business accounts and organizations"
        actions={
          <Can permission="customers.create">
            <Button onClick={() => setFormMode("create")}>
              <Plus /> New customer
            </Button>
          </Can>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => patchParams({ search: e.target.value }, true)}
            placeholder="Search customers…"
            aria-label="Search customers"
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status ?? ""}
          onChange={(e) =>
            patchParams({ status: e.target.value || null }, true)
          }
          className="w-40"
        >
          <option value="">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
      </div>

      {listQuery.isPending && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading customers">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {listQuery.isError && (
        <ErrorState
          title="Customers couldn't load"
          description="Check your connection and try again."
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {showEmpty && (
        <EmptyState
          icon={Users}
          status="No customers"
          title="No customers yet"
          description="Create your first customer to begin building your CRM."
          actionLabel={canCreate ? "Add customer" : undefined}
          onAction={canCreate ? () => setFormMode("create") : undefined}
        />
      )}

      {showFilteredEmpty && (
        <EmptyState
          icon={Search}
          status="No matches"
          title="No customers match"
          description="Try a different search or clear the status filter."
        />
      )}

      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="space-y-3">
          <CustomersTable
            customers={items}
            sortBy={sortBy}
            sortDesc={sortDesc}
            onSort={handleSort}
            onRowClick={openCustomer}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} customer{total === 1 ? "" : "s"}
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

      {/* Detail drawer */}
      <Drawer
        open={Boolean(customerId) && formMode !== "edit"}
        onOpenChange={(open) => {
          if (!open) closeCustomer();
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title="Customer"
            description="Account details from your CRM"
          />
          <DrawerBody>
            <CustomerDetail
              customer={detailQuery.data}
              isPending={detailQuery.isPending}
              isError={detailQuery.isError}
              onRetry={() => void detailQuery.refetch()}
              onEdit={() => setFormMode("edit")}
              onArchive={() => setArchiveOpen(true)}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Create / edit drawer */}
      <Drawer
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) setFormMode(null);
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title={formMode === "edit" ? "Edit customer" : "New customer"}
            description={
              formMode === "edit"
                ? "Update this business account"
                : "Add a business account or organization"
            }
          />
          <DrawerBody>
            <CustomerForm
              initial={formMode === "edit" ? detailQuery.data : null}
              currentUserId={currentUserId}
              submitLabel={formMode === "edit" ? "Save changes" : "Create customer"}
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
        title="Archive customer?"
        description="This customer will be archived and removed from the active list. You can restore it later when that capability ships."
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}
