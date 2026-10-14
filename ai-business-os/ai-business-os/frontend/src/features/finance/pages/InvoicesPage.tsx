import { useCallback, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerOptions } from "@/features/crm/hooks/useCustomerOptions";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { InvoiceForm } from "../components/InvoiceForm";
import { InvoicesTable } from "../components/InvoicesTable";
import { useCreateInvoice, useInvoices } from "../hooks/useInvoices";
import { INVOICE_STATUSES, type InvoiceStatus } from "../types";
import { invoiceFormErrors, type InvoiceFormErrors } from "../lib/invoiceValidation";

const PAGE_SIZE = 20;
const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

export function InvoicesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<InvoiceFormErrors | null>(null);
  const canCreate = usePermission("invoices.create");
  const customers = useCustomerOptions(true);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const search = params.get("search") ?? "";
  const status = (INVOICE_STATUSES as readonly string[]).includes(params.get("status") ?? "")
    ? (params.get("status") as InvoiceStatus)
    : undefined;
  const customerId = params.get("customerId") || undefined;
  const debouncedSearch = useDebounce(search, 300);
  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      status,
      customerId,
      sortBy: "created_at" as const,
      sortDesc: true,
    }),
    [page, debouncedSearch, status, customerId],
  );
  const query = useInvoices(listParams);
  const create = useCreateInvoice();
  const patch = useCallback(
    (values: Record<string, string | null>, reset = false) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(values).forEach(([key, value]) =>
          value ? next.set(key, value) : next.delete(key),
        );
        if (reset) next.set("page", "1");
        return next;
      }),
    [setParams],
  );
  const items = query.data?.items ?? [];
  const filtered = Boolean(debouncedSearch.trim() || status || customerId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Create and manage customer invoices"
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setFormErrors(null);
                setCreateOpen(true);
              }}
            >
              <Plus /> New invoice
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search invoices"
            placeholder="Search invoice number…"
            value={search}
            onChange={(e) => patch({ search: e.target.value }, true)}
            className="pl-8"
          />
        </div>
        <Select
          aria-label="Filter invoices by status"
          value={status ?? ""}
          onChange={(e) => patch({ status: e.target.value || null }, true)}
          className="w-44"
        >
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace("_", " ")}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter invoices by customer"
          value={customerId ?? ""}
          onChange={(e) => patch({ customerId: e.target.value || null }, true)}
          className="w-52"
          disabled={customers.isPending}
          title={
            customers.truncated
              ? `Showing first ${customers.customers.length} of ${customers.total} customers`
              : undefined
          }
        >
          <option value="">All customers</option>
          {customers.customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.companyName}
            </option>
          ))}
        </Select>
      </div>
      {query.isPending ? (
        <div className="space-y-2" aria-label="Loading invoices">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Invoices could not be loaded"
          description={message(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtered ? "No matching invoices" : "No invoices yet"}
          description={
            filtered
              ? "Adjust your search, status, or customer filter."
              : "Create your first customer invoice when you are ready."
          }
          actionLabel={!filtered && canCreate ? "New invoice" : undefined}
          onAction={
            !filtered && canCreate
              ? () => {
                  setFormErrors(null);
                  setCreateOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <>
          <InvoicesTable invoices={items} />
          <Pagination
            page={query.data!.meta.page}
            totalPages={query.data!.meta.totalPages}
            onPageChange={(next) => patch({ page: String(next) })}
          />
        </>
      )}
      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <DrawerContent side="right" className="max-w-2xl">
          <DrawerHeader
            title="New invoice"
            description="Draft a customer invoice. Totals are calculated on save."
          />
          <DrawerBody>
            <InvoiceForm
              busy={create.isPending}
              errors={formErrors}
              onErrorsChange={setFormErrors}
              onCancel={() => setCreateOpen(false)}
              onSubmit={async (payload) => {
                setFormErrors(null);
                try {
                  const created = await create.mutateAsync(payload);
                  toast.success("Invoice created");
                  setCreateOpen(false);
                  navigate(`/finance/invoices/${created.id}`);
                } catch (error) {
                  const mapped = invoiceFormErrors(error);
                  if (mapped) setFormErrors(mapped);
                  else toast.error(message(error));
                }
              }}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
