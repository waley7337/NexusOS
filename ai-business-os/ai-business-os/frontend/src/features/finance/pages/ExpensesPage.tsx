import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { ExpenseForm } from "../components/ExpenseForm";
import { ExpensesTable } from "../components/ExpensesTable";
import { FinanceTabs } from "../components/FinanceTabs";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "../hooks/useExpenses";
import {
  expenseFormErrors,
  type ExpenseFormErrors,
} from "../lib/expenseValidation";
import type { Expense } from "../types";

const PAGE_SIZE = 20;
const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

export function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [formErrors, setFormErrors] = useState<ExpenseFormErrors | null>(null);
  const canCreate = usePermission("expenses.create");
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const debouncedSearch = useDebounce(search, 300);
  const listParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      category: category.trim() || undefined,
      sortBy: "date" as const,
      sortDesc: true,
    }),
    [page, debouncedSearch, category],
  );
  const query = useExpenses(listParams);
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const remove = useDeleteExpense();
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
  const total = query.data?.meta.total ?? 0;
  const totalPages = query.data?.meta.totalPages ?? 1;
  const filtered = Boolean(debouncedSearch.trim() || category.trim());

  // After delete/filter, URL page can exceed totalPages → empty items but total > 0.
  useEffect(() => {
    if (!query.isSuccess) return;
    if (totalPages > 0 && page > totalPages) {
      patch({ page: String(totalPages) });
    }
  }, [query.isSuccess, page, totalPages, patch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track company spending by category and date"
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                setFormErrors(null);
                setEditing(null);
                setCreateOpen(true);
              }}
            >
              <Plus /> New expense
            </Button>
          ) : undefined
        }
      />
      <FinanceTabs />
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search expenses"
            placeholder="Search category or description…"
            value={search}
            onChange={(e) => patch({ search: e.target.value }, true)}
            className="pl-8"
          />
        </div>
        <Input
          aria-label="Filter expenses by category"
          placeholder="Category filter"
          value={category}
          onChange={(e) => patch({ category: e.target.value || null }, true)}
          className="w-44"
        />
      </div>
      {query.isPending ? (
        <div className="space-y-2" aria-label="Loading expenses">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Expenses could not be loaded"
          description={message(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtered ? "No matching expenses" : "No expenses yet"}
          description={
            filtered
              ? "Adjust your search or category filter."
              : "Record your first expense when you are ready."
          }
          actionLabel={!filtered && canCreate ? "New expense" : undefined}
          onAction={
            !filtered && canCreate
              ? () => {
                  setFormErrors(null);
                  setEditing(null);
                  setCreateOpen(true);
                }
              : undefined
          }
        />
      ) : items.length === 0 ? (
        // Page beyond totalPages — clamp effect will rewrite the URL.
        <div className="space-y-2" aria-label="Loading expenses">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <>
          <ExpensesTable
            expenses={items}
            onEdit={(expense) => {
              setFormErrors(null);
              setEditing(expense);
            }}
            onDelete={setDeleting}
          />
          <Pagination
            page={query.data!.meta.page}
            totalPages={totalPages}
            onPageChange={(next) => patch({ page: String(next) })}
          />
        </>
      )}

      <Drawer
        open={createOpen || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
            setFormErrors(null);
          }
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title={editing ? "Edit expense" : "New expense"}
            description="Amounts are stored as decimal currency values."
          />
          <DrawerBody>
            <ExpenseForm
              key={editing?.id ?? "create"}
              expense={editing ?? undefined}
              busy={create.isPending || update.isPending}
              errors={formErrors}
              onErrorsChange={setFormErrors}
              onCancel={() => {
                setCreateOpen(false);
                setEditing(null);
              }}
              onSubmit={async (payload) => {
                setFormErrors(null);
                try {
                  if (editing) {
                    await update.mutateAsync({ id: editing.id, payload });
                    toast.success("Expense updated");
                    setEditing(null);
                  } else {
                    await create.mutateAsync(payload);
                    toast.success("Expense created");
                    setCreateOpen(false);
                  }
                } catch (error) {
                  const mapped = expenseFormErrors(error);
                  if (mapped) setFormErrors(mapped);
                  else toast.error(message(error));
                }
              }}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete expense"
        description="This soft-deletes the expense and removes it from the active list."
        confirmLabel="Delete expense"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          void remove
            .mutateAsync(deleting.id)
            .then(() => {
              toast.success("Expense deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(message(error)));
        }}
      />
    </div>
  );
}
