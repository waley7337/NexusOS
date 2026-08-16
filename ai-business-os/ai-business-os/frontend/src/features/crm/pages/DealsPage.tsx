/**
 * Deals workspace — commercial outcomes bound to leads (Part 06.9).
 *
 * No search: Deal model has no searchable text field (06.8).
 * Customer context is derived via Deal → Lead → Customer (never sent to API).
 * Lead→Deal conversion / pipeline automation is intentionally absent.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Handshake, Plus } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { Can } from "@/components/can";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
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
import { usePermission } from "@/hooks/usePermission";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { DealDetail } from "@/features/crm/components/DealDetail";
import { DealForm } from "@/features/crm/components/DealForm";
import { DealsTable } from "@/features/crm/components/DealsTable";
import { CrmSubnav } from "@/features/crm/components/CrmSubnav";
import type { DealFormValues } from "@/features/crm/schemas/dealSchema";
import {
  emptyToNull,
  normalizeCurrency,
} from "@/features/crm/schemas/dealSchema";
import { datetimeLocalToIso } from "@/features/crm/lib/dealFormValues";
import { DEAL_STATUS_LABELS } from "@/features/crm/lib/dealDisplay";
import { leadOptionLabel } from "@/features/crm/hooks/useLeadOptions";
import {
  useBoundDealLeadIds,
  useLeadOptions,
} from "@/features/crm/hooks/useLeadOptions";
import {
  useArchiveDeal,
  useCreateDeal,
  useDeal,
  useDeals,
  useUpdateDeal,
} from "@/features/crm/hooks/useDeals";
import { useLead } from "@/features/crm/hooks/useLeads";
import { useCustomerOptions } from "@/features/crm/hooks/useCustomerOptions";
import {
  DEAL_SORT_FIELDS,
  DEAL_STATUSES,
  type Deal,
  type DealCreatePayload,
  type DealSortField,
  type DealStatus,
  type DealUpdatePayload,
} from "@/features/crm/types";

const DEFAULT_PAGE_SIZE = 20;

function parseSortBy(value: string | null): DealSortField {
  if (value && (DEAL_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as DealSortField;
  }
  return "created_at";
}

function parseStatus(value: string | null): DealStatus | "" {
  if (value && (DEAL_STATUSES as readonly string[]).includes(value)) {
    return value as DealStatus;
  }
  return "";
}

function toCreatePayload(values: DealFormValues): DealCreatePayload {
  const payload: DealCreatePayload = {
    leadId: values.leadId,
    value: Number(values.value),
    currency: normalizeCurrency(values.currency),
    status: values.status,
  };
  const wonAt = datetimeLocalToIso(values.wonAt);
  const lostReason = emptyToNull(values.lostReason);
  if (wonAt) payload.wonAt = wonAt;
  if (lostReason) payload.lostReason = lostReason;
  return payload;
}

function toUpdatePayload(values: DealFormValues): DealUpdatePayload {
  return {
    value: Number(values.value),
    currency: normalizeCurrency(values.currency),
    status: values.status,
    wonAt: datetimeLocalToIso(values.wonAt),
    lostReason: emptyToNull(values.lostReason),
  };
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

export function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const canCreate = usePermission("deals.create");
  const canReadLeads = usePermission("leads.read");
  const canReadCustomers = usePermission("customers.read");

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)) ||
        DEFAULT_PAGE_SIZE,
    ),
  );
  const statusFilter = parseStatus(searchParams.get("status"));
  const leadFilter = searchParams.get("leadId") ?? "";
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDesc = searchParams.get("sortDesc") !== "false";
  const dealId = searchParams.get("deal");

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter || undefined,
      leadId: leadFilter || undefined,
      sortBy,
      sortDesc,
    }),
    [page, pageSize, statusFilter, leadFilter, sortBy, sortDesc],
  );

  const listQuery = useDeals(listParams);
  const detailQuery = useDeal(dealId);
  const leadOptions = useLeadOptions(canReadLeads || canCreate);
  const customerOptions = useCustomerOptions(canReadCustomers || canCreate);
  const boundDeals = useBoundDealLeadIds(canCreate);

  const missingLeadId =
    detailQuery.data && !leadOptions.leadById.has(detailQuery.data.leadId)
      ? detailQuery.data.leadId
      : null;
  const missingLeadQuery = useLead(missingLeadId);

  const createMutation = useCreateDeal();
  const updateMutation = useUpdateDeal();
  const archiveMutation = useArchiveDeal();

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

  const openDeal = (deal: Deal) => {
    patchParams({ deal: deal.id });
  };

  const closeDeal = () => {
    patchParams({ deal: null });
    setFormMode(null);
    setArchiveOpen(false);
  };

  const handleSort = (field: DealSortField) => {
    if (sortBy === field) {
      patchParams({ sortDesc: sortDesc ? "false" : "true" });
    } else {
      patchParams({
        sortBy: field,
        sortDesc: field === "created_at" || field === "value" ? "true" : "false",
      });
    }
  };

  const handleCreate = async (values: DealFormValues) => {
    try {
      const created = await createMutation.mutateAsync(toCreatePayload(values));
      toast.success("Deal created");
      setFormMode(null);
      patchParams({ deal: created.id, page: "1" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not create deal."));
    }
  };

  const handleUpdate = async (values: DealFormValues) => {
    if (!dealId) return;
    try {
      const payload = toUpdatePayload(values);
      await updateMutation.mutateAsync({ id: dealId, payload });
      toast.success("Deal updated");
      setFormMode(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update deal."));
    }
  };

  const handleStatusChange = async (status: DealStatus) => {
    if (!dealId || !detailQuery.data) return;
    if (detailQuery.data.status === status) return;
    try {
      await updateMutation.mutateAsync({
        id: dealId,
        payload: { status },
      });
      toast.success("Status updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update status."));
    }
  };

  const handleArchive = async () => {
    if (!dealId) return;
    try {
      await archiveMutation.mutateAsync(dealId);
      toast.success("Deal archived");
      setArchiveOpen(false);
      closeDeal();
    } catch (err) {
      toast.error(errorMessage(err, "Could not archive deal."));
    }
  };

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const leadCount = leadOptions.total;
  const hasLeads = leadCount > 0;

  const createLeadChoices = useMemo(() => {
    return leadOptions.leads.filter((lead) => !boundDeals.boundLeadIds.has(lead.id));
  }, [leadOptions.leads, boundDeals.boundLeadIds]);

  const boundLeadForDetail =
    (detailQuery.data &&
      (leadOptions.leadById.get(detailQuery.data.leadId) ??
        (missingLeadQuery.data?.id === detailQuery.data.leadId
          ? missingLeadQuery.data
          : null))) ||
    null;

  const showEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    total === 0 &&
    !statusFilter &&
    !leadFilter;
  const showFilteredEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    items.length === 0 &&
    (Boolean(statusFilter) || Boolean(leadFilter));

  const openCreate = () => {
    if (!hasLeads) return;
    setFormMode("create");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        description="Track commercial outcomes from your sales pipeline"
        actions={
          <Can permission="deals.create">
            <Button onClick={openCreate} disabled={!hasLeads && !leadOptions.isPending}>
              <Plus /> New deal
            </Button>
          </Can>
        }
      />

      <CrmSubnav />

      <div
        className="flex flex-wrap gap-1 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by deal status"
      >
        <button
          type="button"
          className={cn(
            "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors duration-fast focus-edge",
            !statusFilter
              ? "bg-primary-fill text-white"
              : "bg-surface-3 text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={!statusFilter}
          onClick={() => patchParams({ status: null }, true)}
        >
          All
        </button>
        {DEAL_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={cn(
              "rounded-btn px-3 py-1.5 text-sm font-medium transition-colors duration-fast focus-edge",
              statusFilter === status
                ? "bg-primary-fill text-white"
                : "bg-surface-3 text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={statusFilter === status}
            onClick={() => patchParams({ status }, true)}
          >
            {DEAL_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {canReadLeads ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by lead"
            value={leadFilter}
            onChange={(e) => patchParams({ leadId: e.target.value || null }, true)}
            className="min-w-52 max-w-md"
          >
            <option value="">All leads</option>
            {leadOptions.leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {leadOptionLabel(lead, customerOptions.nameById)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {listQuery.isPending && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading deals">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {listQuery.isError && (
        <ErrorState
          title="Deals couldn't load"
          description="Check your connection and try again."
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {showEmpty && !hasLeads && !leadOptions.isPending && (
        <EmptyState
          icon={Handshake}
          status="No leads"
          title="Create a lead first"
          description="Deals represent commercial outcomes connected to leads. Add a lead before creating deals."
          actionLabel="Go to Leads"
          onAction={() => navigate(ROUTES.crmLeads)}
        />
      )}

      {showEmpty && hasLeads && (
        <EmptyState
          icon={Handshake}
          status="No deals"
          title="No deals yet"
          description="Deals represent commercial outcomes connected to leads."
          actionLabel={canCreate ? "Add deal" : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      )}

      {showFilteredEmpty && (
        <EmptyState
          icon={Handshake}
          status="No matches"
          title="No deals match"
          description="Try a different status or clear the lead filter."
        />
      )}

      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="space-y-3">
          <DealsTable
            deals={items}
            leadById={leadOptions.leadById}
            customerNameById={customerOptions.nameById}
            sortBy={sortBy}
            sortDesc={sortDesc}
            onSort={handleSort}
            onRowClick={openDeal}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} deal{total === 1 ? "" : "s"}
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
        open={Boolean(dealId) && formMode !== "edit"}
        onOpenChange={(open) => {
          if (!open) closeDeal();
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title="Deal"
            description="Commercial outcome linked to a lead"
          />
          <DrawerBody>
            <DealDetail
              deal={detailQuery.data}
              boundLead={boundLeadForDetail}
              customerNameById={customerOptions.nameById}
              isPending={detailQuery.isPending}
              isError={detailQuery.isError}
              statusPending={updateMutation.isPending}
              onRetry={() => void detailQuery.refetch()}
              onEdit={() => setFormMode("edit")}
              onArchive={() => setArchiveOpen(true)}
              onStatusChange={(status) => void handleStatusChange(status)}
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
            title={formMode === "edit" ? "Edit deal" : "New deal"}
            description={
              formMode === "edit"
                ? "Update commercial outcome details"
                : "Bind a deal to one lead"
            }
          />
          <DrawerBody>
            {formMode === "create" && leadOptions.truncated && (
              <p className="mb-3 text-xs text-muted-foreground">
                Showing the first {leadOptions.leads.length} leads in the picker.
              </p>
            )}
            {formMode === "create" &&
              hasLeads &&
              createLeadChoices.length === 0 &&
              !boundDeals.isPending && (
                <p className="mb-3 text-sm text-muted-foreground">
                  Every lead in the picker already has an active deal. Archive an
                  existing deal or create a new lead first.
                </p>
              )}
            <DealForm
              mode={formMode === "edit" ? "edit" : "create"}
              initial={formMode === "edit" ? detailQuery.data : null}
              leadChoices={createLeadChoices}
              customerNameById={customerOptions.nameById}
              boundLead={formMode === "edit" ? boundLeadForDetail : null}
              submitLabel={formMode === "edit" ? "Save changes" : "Create deal"}
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
        title="Archive deal?"
        description="This deal will be archived and removed from the active list."
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}
