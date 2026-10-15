import { useCallback, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { HrTabs } from "../components/HrTabs";
import { useAttendance, useClockIn, useClockOut } from "../hooks/useAttendance";

const PAGE_SIZE = 20;

const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function AttendancePage() {
  const canClock = usePermission("attendance.clock");
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  const patch = useCallback(
    (values: Record<string, string | null>) =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        Object.entries(values).forEach(([key, value]) =>
          value ? next.set(key, value) : next.delete(key),
        );
        return next;
      }),
    [setParams],
  );

  const listParams = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, sortBy: "date", sortDesc: true }),
    [page],
  );
  const query = useAttendance(listParams);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const items = query.data?.items ?? [];
  const totalPages = query.data?.meta.totalPages ?? 1;

  useEffect(() => {
    if (!query.isSuccess) return;
    if (totalPages > 0 && page > totalPages) {
      patch({ page: String(totalPages) });
    }
  }, [query.isSuccess, page, totalPages, patch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Daily clock-in and clock-out records."
        actions={
          canClock ? (
            <div className="flex gap-2">
              <Button
                disabled={clockIn.isPending || clockOut.isPending}
                onClick={() =>
                  clockIn.mutate(undefined, {
                    onSuccess: () => toast.success("Clocked in."),
                    onError: (error) => toast.error(message(error)),
                  })
                }
              >
                Clock in
              </Button>
              <Button
                variant="outline"
                disabled={clockIn.isPending || clockOut.isPending}
                onClick={() =>
                  clockOut.mutate(undefined, {
                    onSuccess: () => toast.success("Clocked out."),
                    onError: (error) => toast.error(message(error)),
                  })
                }
              >
                Clock out
              </Button>
            </div>
          ) : undefined
        }
      />
      <HrTabs />

      {query.isPending ? (
        <div className="space-y-2" aria-label="Loading attendance">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Attendance unavailable"
          description={message(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No attendance records"
          description="Clock in to start today's attendance entry."
        />
      ) : (
        <>
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.date}
                    {item.employeeFullName ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {item.employeeFullName}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    In {formatTime(item.clockIn)} · Out {formatTime(item.clockOut)}
                  </p>
                </div>
                <p className="text-machine text-sm tabular-nums">
                  {item.hoursWorked ? `${item.hoursWorked} h` : "—"}
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            page={query.data!.meta.page}
            totalPages={totalPages}
            onPageChange={(next) => patch({ page: String(next) })}
          />
        </>
      )}
    </div>
  );
}
