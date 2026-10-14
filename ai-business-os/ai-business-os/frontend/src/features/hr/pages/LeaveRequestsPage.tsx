import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { toast } from "sonner";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/hooks/usePermission";
import { HrTabs } from "../components/HrTabs";
import {
  useApproveLeaveRequest,
  useCreateLeaveRequest,
  useLeaveRequests,
  useRejectLeaveRequest,
} from "../hooks/useLeaveRequests";
import {
  APPROVAL_STATUSES,
  LEAVE_TYPES,
  type ApprovalStatus,
  type LeaveType,
} from "../types";

const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

export function LeaveRequestsPage() {
  const canCreate = usePermission("leave_requests.create");
  const canApprove = usePermission("leave_requests.approve");
  const [createOpen, setCreateOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "">("");

  const params = useMemo(
    () => ({
      page: 1,
      pageSize: 50,
      sortBy: "created_at",
      sortDesc: true,
      approvalStatus: statusFilter || undefined,
    }),
    [statusFilter],
  );
  const query = useLeaveRequests(params);
  const create = useCreateLeaveRequest();
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();
  const items = query.data?.items ?? [];

  const submit = async () => {
    if (!startDate || !endDate) {
      toast.error("Start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after start date.");
      return;
    }
    try {
      await create.mutateAsync({
        leaveType,
        startDate,
        endDate,
        reason: reason.trim() || null,
      });
      toast.success("Leave request submitted.");
      setCreateOpen(false);
      setReason("");
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        description="Submit time off and review approval status."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Request leave
            </Button>
          ) : undefined
        }
      />
      <HrTabs />

      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ApprovalStatus | "")
          }
          className="max-w-xs"
        >
          <option value="">All statuses</option>
          {APPROVAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <div className="space-y-2" aria-label="Loading leave requests">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Leave requests unavailable"
          description={message(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          description="Submitted leave requests will appear here."
        />
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium capitalize">
                  {item.leaveType.replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.startDate} → {item.endDate}
                </p>
                {item.reason ? (
                  <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                ) : null}
                <p className="text-machine mt-1 text-2xs uppercase tracking-wide">
                  {item.approvalStatus}
                </p>
              </div>
              {canApprove && item.approvalStatus === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={approve.isPending || reject.isPending}
                    onClick={() =>
                      approve.mutate(item.id, {
                        onSuccess: () => toast.success("Leave approved."),
                        onError: (error) => toast.error(message(error)),
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={approve.isPending || reject.isPending}
                    onClick={() =>
                      reject.mutate(item.id, {
                        onSuccess: () => toast.success("Leave rejected."),
                        onError: (error) => toast.error(message(error)),
                      })
                    }
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Drawer open={createOpen} onOpenChange={setCreateOpen}>
        <DrawerContent>
          <DrawerHeader title="Request leave" />
          <DrawerBody className="space-y-4">
            <Select
              aria-label="Leave type"
              value={leaveType}
              onChange={(event) => setLeaveType(event.target.value as LeaveType)}
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
            <Input
              aria-label="Reason"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button disabled={create.isPending} onClick={() => void submit()}>
              Submit request
            </Button>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
