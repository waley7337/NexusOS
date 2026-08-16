/**
 * Leads workspace — sales pipeline list (Part 06.7).
 *
 * Table-first (not Kanban): the Leads API is paginated, so a board of cards
 * would misrepresent incomplete pages as the full pipeline. Stage chips
 * filter server-side via pipelineStage.
 *
 * Customer names: bounded options cache (≤100). Assignee: me / unassigned
 * only — no tenant members API.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Target } from "lucide-react";
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
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { LeadDetail } from "@/features/crm/components/LeadDetail";
import { LeadForm } from "@/features/crm/components/LeadForm";
import { LeadsTable } from "@/features/crm/components/LeadsTable";
import { CrmSubnav } from "@/features/crm/components/CrmSubnav";
import type { LeadFormValues } from "@/features/crm/schemas/leadSchema";
import {
  emptyToNull,
  emptyToNumberOrNull,
} from "@/features/crm/schemas/leadSchema";
import { PIPELINE_STAGE_LABELS } from "@/features/crm/lib/leadDisplay";
import {
  useArchiveLead,
  useCreateLead,
  useLead,
  useLeads,
  useUpdateLead,
} from "@/features/crm/hooks/useLeads";
import { useCustomer } from "@/features/crm/hooks/useCustomers";
import { useCustomerOptions } from "@/features/crm/hooks/useCustomerOptions";
import {
  LEAD_SORT_FIELDS,
  PIPELINE_STAGES,
  type Lead,
  type LeadCreatePayload,
  type LeadSortField,
  type PipelineStage,
} from "@/features/crm/types";

const DEFAULT_PAGE_SIZE = 20;

function parseSortBy(value: string | null): LeadSortField {
  if (value && (LEAD_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as LeadSortField;
  }
  return "created_at";
}

function parseStage(value: string | null): PipelineStage | "" {
  if (value && (PIPELINE_STAGES as readonly string[]).includes(value)) {
    return value as PipelineStage;
  }
  return "";
}

function toPayload(
  values: LeadFormValues,
  currentUserId: string | null,
): LeadCreatePayload {
  const payload: LeadCreatePayload = {
    customerId: values.customerId,
    pipelineStage: values.pipelineStage,
    estimatedValue: emptyToNumberOrNull(values.estimatedValue),
    probability: emptyToNumberOrNull(values.probability),
    expectedCloseDate: emptyToNull(values.expectedCloseDate),
    notes: emptyToNull(values.notes),
  };
  if (values.assigneeMode === "me" && currentUserId) {
    payload.assignedTo = currentUserId;
  } else if (values.assigneeMode === "unassigned") {
    payload.assignedTo = null;
  }
  // assigneeMode === "other": omit assignedTo to preserve existing assignee
  return payload;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

export function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreate = usePermission("leads.create");
  const canReadCustomers = usePermission("customers.read");
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

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
  const stageFilter = parseStage(searchParams.get("pipelineStage"));
  const assignedFilter = searchParams.get("assignedTo") ?? "";
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDesc = searchParams.get("sortDesc") !== "false";
  const leadId = searchParams.get("lead");

  const debouncedSearch = useDebounce(searchInput, 300);

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      customerId: customerFilter || undefined,
      pipelineStage: stageFilter || undefined,
      assignedTo:
        assignedFilter === "me" && currentUserId
          ? currentUserId
          : assignedFilter && assignedFilter !== "me"
            ? assignedFilter
            : undefined,
      sortBy,
      sortDesc,
    }),
    [
      page,
      pageSize,
      debouncedSearch,
      customerFilter,
      stageFilter,
      assignedFilter,
      currentUserId,
      sortBy,
      sortDesc,
    ],
  );

  const listQuery = useLeads(listParams);
  const detailQuery = useLead(leadId);
  const optionsQuery = useCustomerOptions(canReadCustomers || canCreate);
  const missingCustomerId =
    detailQuery.data && !optionsQuery.nameById.has(detailQuery.data.customerId)
      ? detailQuery.data.customerId
      : null;
  const missingCustomerQuery = useCustomer(missingCustomerId);

  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const archiveMutation = useArchiveLead();

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

  const openLead = (lead: Lead) => {
    patchParams({ lead: lead.id });
  };

  const closeLead = () => {
    patchParams({ lead: null });
    setFormMode(null);
    setArchiveOpen(false);
  };

  const handleSort = (field: LeadSortField) => {
    if (sortBy === field) {
      patchParams({ sortDesc: sortDesc ? "false" : "true" });
    } else {
      patchParams({
        sortBy: field,
        sortDesc: field === "created_at" ? "true" : "false",
      });
    }
  };

  const handleCreate = async (values: LeadFormValues) => {
    try {
      const created = await createMutation.mutateAsync(
        toPayload(values, currentUserId),
      );
      toast.success("Lead created");
      setFormMode(null);
      patchParams({ lead: created.id, page: "1" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not create lead."));
    }
  };

  const handleUpdate = async (values: LeadFormValues) => {
    if (!leadId) return;
    try {
      const payload = toPayload(values, currentUserId);
      // Preserve teammate assignee when mode is "other"
      if (values.assigneeMode === "other") {
        delete payload.assignedTo;
      }
      await updateMutation.mutateAsync({ id: leadId, payload });
      toast.success("Lead updated");
      setFormMode(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update lead."));
    }
  };

  const handleStageChange = async (stage: PipelineStage) => {
    if (!leadId || !detailQuery.data) return;
    if (detailQuery.data.pipelineStage === stage) return;
    try {
      await updateMutation.mutateAsync({
        id: leadId,
        payload: { pipelineStage: stage },
      });
      toast.success("Stage updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update stage."));
    }
  };

  const handleArchive = async () => {
    if (!leadId) return;
    try {
      await archiveMutation.mutateAsync(leadId);
      toast.success("Lead archived");
      setArchiveOpen(false);
      closeLead();
    } catch (err) {
      toast.error(errorMessage(err, "Could not archive lead."));
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
    !customerFilter &&
    !stageFilter &&
    !assignedFilter;
  const showFilteredEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    items.length === 0 &&
    (Boolean(debouncedSearch.trim()) ||
      Boolean(customerFilter) ||
      Boolean(stageFilter) ||
      Boolean(assignedFilter));

  const openCreate = () => {
    if (!hasCustomers) return;
    setFormMode("create");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Track sales opportunities through your pipeline"
        actions={
          <Can permission="leads.create">
            <Button onClick={openCreate} disabled={!hasCustomers && !optionsQuery.isPending}>
              <Plus /> New lead
            </Button>
          </Can>
        }
      />

      <CrmSubnav />

      <div
        className="flex flex-wrap gap-1 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by pipeline stage"
      >
        <button
          type="button"
          className={cn(
            "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors duration-fast focus-edge",
            !stageFilter
              ? "bg-primary-fill text-white"
              : "bg-surface-3 text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={!stageFilter}
          onClick={() => patchParams({ pipelineStage: null }, true)}
        >
          All stages
        </button>
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            className={cn(
              "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors duration-fast focus-edge",
              stageFilter === stage
                ? "bg-primary-fill text-white"
                : "bg-surface-3 text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={stageFilter === stage}
            onClick={() => patchParams({ pipelineStage: stage }, true)}
          >
            {PIPELINE_STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(e) => patchParams({ search: e.target.value }, true)}
            placeholder="Search notes…"
            aria-label="Search lead notes"
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
        {currentUserId ? (
          <Select
            aria-label="Filter by assignee"
            value={assignedFilter === currentUserId ? "me" : assignedFilter}
            onChange={(e) => {
              const v = e.target.value;
              patchParams(
                { assignedTo: v === "me" ? "me" : v || null },
                true,
              );
            }}
            className="min-w-40 max-w-xs"
          >
            <option value="">All assignees</option>
            <option value="me">Assigned to me</option>
          </Select>
        ) : null}
      </div>

      {listQuery.isPending && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading leads">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {listQuery.isError && (
        <ErrorState
          title="Leads couldn't load"
          description="Check your connection and try again."
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {showEmpty && !hasCustomers && !optionsQuery.isPending && (
        <EmptyState
          icon={Target}
          status="No customers"
          title="Create a customer first"
          description="Leads track opportunities against customer accounts. Add a customer before creating leads."
          actionLabel="Go to Customers"
          onAction={() => navigate(ROUTES.crmCustomers)}
        />
      )}

      {showEmpty && hasCustomers && (
        <EmptyState
          icon={Target}
          status="No leads"
          title="No leads yet"
          description="Create a lead to begin tracking sales opportunities."
          actionLabel={canCreate ? "Add lead" : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      )}

      {showFilteredEmpty && (
        <EmptyState
          icon={Search}
          status="No matches"
          title="No leads match"
          description="Try a different search or clear stage and customer filters."
        />
      )}

      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="space-y-3">
          <LeadsTable
            leads={items}
            nameById={optionsQuery.nameById}
            currentUserId={currentUserId}
            sortBy={sortBy}
            sortDesc={sortDesc}
            onSort={handleSort}
            onRowClick={openLead}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} lead{total === 1 ? "" : "s"}
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
        open={Boolean(leadId) && formMode !== "edit"}
        onOpenChange={(open) => {
          if (!open) closeLead();
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader title="Lead" description="Sales opportunity in your pipeline" />
          <DrawerBody>
            <LeadDetail
              lead={detailQuery.data}
              nameById={optionsQuery.nameById}
              resolvedCustomer={missingCustomerQuery.data}
              currentUserId={currentUserId}
              isPending={detailQuery.isPending}
              isError={detailQuery.isError}
              stagePending={updateMutation.isPending}
              onRetry={() => void detailQuery.refetch()}
              onEdit={() => setFormMode("edit")}
              onArchive={() => setArchiveOpen(true)}
              onStageChange={(stage) => void handleStageChange(stage)}
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
            title={formMode === "edit" ? "Edit lead" : "New lead"}
            description={
              formMode === "edit"
                ? "Update this opportunity"
                : "Add a sales opportunity linked to a customer"
            }
          />
          <DrawerBody>
            {optionsQuery.truncated && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing the first {optionsQuery.customers.length} customers in the
                picker. Use search on Customers if you need another account.
              </p>
            )}
            <LeadForm
              initial={formMode === "edit" ? detailQuery.data : null}
              customers={optionsQuery.customers}
              currentUserId={currentUserId}
              submitLabel={formMode === "edit" ? "Save changes" : "Create lead"}
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
        title="Archive lead?"
        description="This lead will be archived and removed from the active list."
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}
