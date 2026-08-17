/**
 * Employees workspace — operational HR UI (Part 07.3).
 *
 * Backed by GET /api/v1/hr/employees. Scoped list for Manager/Employee;
 * company directory for Owner/Admin. No mock data.
 */
import { useCallback, useMemo } from "react";
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
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { PageLoading } from "@/components/page-loading";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthMe } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth";
import { EmployeesTable } from "@/features/hr/components/EmployeesTable";
import {
  EmployeeForm,
  formValuesToPayload,
} from "@/features/hr/components/EmployeeForm";
import { useEmployeeOptions } from "@/features/hr/hooks/useEmployeeOptions";
import {
  useCreateEmployee,
  useEmployees,
} from "@/features/hr/hooks/useEmployees";
import { hrPageCopy, splitManagerList, useHrAccess } from "@/features/hr/lib/hrAccess";
import type { EmployeeFormValues } from "@/features/hr/schemas/employeeSchema";
import {
  EMPLOYEE_SORT_FIELDS,
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type Employee,
  type EmployeeSortField,
  type EmployeeStatus,
  type EmploymentType,
} from "@/features/hr/types";
import { EMPLOYMENT_LABEL, STATUS_LABEL } from "@/features/hr/lib/employeeDisplay";

const DEFAULT_PAGE_SIZE = 20;

function parseSortBy(value: string | null): EmployeeSortField {
  if (value && (EMPLOYEE_SORT_FIELDS as readonly string[]).includes(value)) {
    return value as EmployeeSortField;
  }
  return "last_name";
}

function parseStatus(value: string | null): EmployeeStatus | undefined {
  if (value && (EMPLOYEE_STATUSES as readonly string[]).includes(value)) {
    return value as EmployeeStatus;
  }
  return undefined;
}

function parseEmploymentType(value: string | null): EmploymentType | undefined {
  if (value && (EMPLOYMENT_TYPES as readonly string[]).includes(value)) {
    return value as EmploymentType;
  }
  return undefined;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

function buildManagerLookup(items: Employee[]): Map<string, Employee> {
  return new Map(items.map((row) => [row.id, row]));
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoading: authLoading } = useAuthMe();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const access = useHrAccess();
  const copy = hrPageCopy(access);

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    ),
  );
  const searchInput = searchParams.get("search") ?? "";
  const status = parseStatus(searchParams.get("status"));
  const employmentType = parseEmploymentType(searchParams.get("employmentType"));
  const sortBy = parseSortBy(searchParams.get("sortBy"));
  const sortDesc = searchParams.get("sortDesc") !== "false";
  const managerId = access.canFilterByManager
    ? searchParams.get("managerId") ?? undefined
    : undefined;
  const createOpen = searchParams.get("create") === "1";

  const debouncedSearch = useDebounce(searchInput, 300);

  const listParams = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch.trim() || undefined,
      status,
      employmentType,
      sortBy,
      sortDesc,
      managerId,
    }),
    [page, pageSize, debouncedSearch, status, employmentType, sortBy, sortDesc, managerId],
  );

  const listQuery = useEmployees(listParams);
  const createMutation = useCreateEmployee();
  const managerOptionsQuery = useEmployeeOptions(access.canDirectory);

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

  const openEmployee = (employee: Employee) => {
    navigate(`/hr/employees/${employee.id}`);
  };

  const handleSort = (field: EmployeeSortField) => {
    if (sortBy === field) {
      patchParams({ sortDesc: sortDesc ? "false" : "true" });
    } else {
      patchParams({ sortBy: field, sortDesc: field === "last_name" ? "false" : "true" });
    }
  };

  const handleCreate = async (values: EmployeeFormValues) => {
    try {
      const created = await createMutation.mutateAsync(
        formValuesToPayload(values, currentUserId, false),
      );
      toast.success("Employee created");
      patchParams({ create: null, page: "1" });
      navigate(`/hr/employees/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not create employee."));
    }
  };

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const managerLookup = buildManagerLookup(items);

  const callerEmployeeId =
    items.find((row) => row.userId === currentUserId)?.id ?? null;
  const { self: selfRows, team: teamRows } = access.isManagerView
    ? splitManagerList(items, currentUserId, callerEmployeeId)
    : { self: [], team: [] };

  const showEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    total === 0 &&
    !debouncedSearch.trim() &&
    !status &&
    !employmentType &&
    !managerId;

  const showFilteredEmpty =
    !listQuery.isPending &&
    !listQuery.isError &&
    items.length === 0 &&
    (Boolean(debouncedSearch.trim()) ||
      Boolean(status) ||
      Boolean(employmentType) ||
      Boolean(managerId));

  const renderTable = (rows: Employee[], heading?: string) => (
    <div className="space-y-2">
      {heading && (
        <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      )}
      <EmployeesTable
        employees={rows}
        sortBy={sortBy}
        sortDesc={sortDesc}
        onSort={handleSort}
        onRowClick={openEmployee}
        managerLookup={managerLookup}
        compact={access.isSelfOnlyView}
      />
    </div>
  );

  if (authLoading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Can permission="employees.create">
            <Button onClick={() => patchParams({ create: "1" })}>
              <Plus /> New employee
            </Button>
          </Can>
        }
      />

      {!access.isSelfOnlyView && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={searchInput}
              onChange={(e) => patchParams({ search: e.target.value }, true)}
              placeholder="Search employees…"
              aria-label="Search employees"
              className="pl-8"
            />
          </div>
          <Select
            aria-label="Filter by status"
            value={status ?? ""}
            onChange={(e) => patchParams({ status: e.target.value || null }, true)}
            className="w-40"
          >
            <option value="">All statuses</option>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by employment type"
            value={employmentType ?? ""}
            onChange={(e) =>
              patchParams({ employmentType: e.target.value || null }, true)
            }
            className="w-44"
          >
            <option value="">All types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {listQuery.isPending && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading employees">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {listQuery.isError && (
        <ErrorState
          title="Employees couldn't load"
          description="Check your connection and try again."
          onRetry={() => void listQuery.refetch()}
        />
      )}

      {showEmpty && (
        <EmptyState
          icon={UserRound}
          status={access.canDirectory ? "No employees" : "No records"}
          title={access.canDirectory ? "No employees yet" : "No employment records"}
          description={
            access.canDirectory
              ? "Create your first employee record to begin HR operations."
              : "You do not have any employment records visible in this workspace."
          }
          actionLabel={access.canCreate ? "Add employee" : undefined}
          onAction={access.canCreate ? () => patchParams({ create: "1" }) : undefined}
        />
      )}

      {showFilteredEmpty && (
        <EmptyState
          icon={Search}
          status="No matches"
          title="No employees match"
          description="Try a different search or clear your filters."
        />
      )}

      {!listQuery.isPending && !listQuery.isError && items.length > 0 && (
        <div className="space-y-6">
          {access.isManagerView ? (
            <>
              {selfRows.length > 0 && renderTable(selfRows, "My employment")}
              {teamRows.length > 0 && renderTable(teamRows, "My team")}
              {selfRows.length === 0 && teamRows.length === 0 && renderTable(items)}
            </>
          ) : (
            renderTable(items)
          )}
          {!access.isSelfOnlyView && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {total} employee{total === 1 ? "" : "s"}
                {meta ? ` · page ${meta.page} of ${meta.totalPages}` : null}
              </p>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => patchParams({ page: String(p) })}
              />
            </div>
          )}
        </div>
      )}

      <Drawer
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) patchParams({ create: null });
        }}
      >
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader
            title="New employee"
            description="Add an HR-only employee or link your NexusOS account"
          />
          <DrawerBody>
            <EmployeeForm
              managerOptions={managerOptionsQuery.data ?? []}
              currentUserId={currentUserId}
              submitLabel="Create employee"
              pending={createMutation.isPending}
              onCancel={() => patchParams({ create: null })}
              onSubmit={handleCreate}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
