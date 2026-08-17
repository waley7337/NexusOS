/**
 * Employee detail — GET /api/v1/hr/employees/{id}
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/auth";
import { EmployeeDetail } from "@/features/hr/components/EmployeeDetail";
import {
  EmployeeForm,
  formValuesToPayload,
} from "@/features/hr/components/EmployeeForm";
import { useEmployeeOptions } from "@/features/hr/hooks/useEmployeeOptions";
import {
  useArchiveEmployee,
  useEmployee,
  useEmployees,
  useUpdateEmployee,
} from "@/features/hr/hooks/useEmployees";
import { useHrAccess } from "@/features/hr/lib/hrAccess";
import type { EmployeeFormValues } from "@/features/hr/schemas/employeeSchema";
import type { Employee } from "@/features/hr/types";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiRequestError) return err.message || fallback;
  return fallback;
}

function buildManagerLookup(items: Employee[]): Map<string, Employee> {
  return new Map(items.map((row) => [row.id, row]));
}

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const access = useHrAccess();

  const detailQuery = useEmployee(employeeId ?? null);
  const listQuery = useEmployees({ page: 1, pageSize: 100 });
  const updateMutation = useUpdateEmployee();
  const archiveMutation = useArchiveEmployee();
  const managerOptionsQuery = useEmployeeOptions(access.canDirectory);

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const managerLookup = useMemo(
    () => buildManagerLookup(listQuery.data?.items ?? []),
    [listQuery.data?.items],
  );

  const handleUpdate = async (values: EmployeeFormValues) => {
    if (!employeeId) return;
    try {
      await updateMutation.mutateAsync({
        id: employeeId,
        payload: formValuesToPayload(values, currentUserId, true),
      });
      toast.success("Employee updated");
      setEditOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update employee."));
    }
  };

  const handleArchive = async () => {
    if (!employeeId) return;
    try {
      await archiveMutation.mutateAsync(employeeId);
      toast.success("Employee archived");
      setArchiveOpen(false);
      navigate(ROUTES.hrEmployees);
    } catch (err) {
      toast.error(errorMessage(err, "Could not archive employee."));
    }
  };

  const employee = detailQuery.data;
  const backLabel = access.canDirectory ? "Employees" : "HR";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee"
        description={employee?.fullName ?? "Employment record"}
        actions={
          <Link
            to={ROUTES.hrEmployees}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to {backLabel}
          </Link>
        }
      />

      <EmployeeDetail
        employee={employee}
        isPending={detailQuery.isPending}
        isError={detailQuery.isError}
        onRetry={() => void detailQuery.refetch()}
        onEdit={access.canUpdate ? () => setEditOpen(true) : undefined}
        onArchive={access.canArchive ? () => setArchiveOpen(true) : undefined}
        managerLookup={managerLookup}
      />

      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent side="right" className="max-w-lg">
          <DrawerHeader title="Edit employee" description="Update employment fields" />
          <DrawerBody>
            <EmployeeForm
              initial={employee}
              managerOptions={managerOptionsQuery.data ?? listQuery.data?.items ?? []}
              currentUserId={currentUserId}
              submitLabel="Save changes"
              pending={updateMutation.isPending}
              onCancel={() => setEditOpen(false)}
              onSubmit={handleUpdate}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive employee?"
        description="This employment record will be archived and removed from active HR views. The linked NexusOS user account is not deleted and authentication access is not automatically revoked."
        confirmLabel="Archive employee"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => void handleArchive()}
      />
    </div>
  );
}
