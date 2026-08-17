import { useEffect, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import {
  employeeFormSchema,
  emptyToNull,
  type EmployeeFormValues,
} from "../schemas/employeeSchema";
import { employeeToFormValues } from "../lib/employeeDisplay";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, type Employee } from "../types";
import { STATUS_LABEL, EMPLOYMENT_LABEL } from "../lib/employeeDisplay";
import { usePermission } from "@/hooks/usePermission";

interface EmployeeFormProps {
  initial?: Employee | null;
  currentUserId: string | null;
  managerOptions: Employee[];
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function EmployeeForm({
  initial,
  currentUserId,
  managerOptions,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const isEdit = Boolean(initial);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employeeToFormValues(initial, currentUserId),
  });

  useEffect(() => {
    reset(employeeToFormValues(initial, currentUserId));
  }, [initial, currentUserId, reset]);

  const mode = watch("mode") ?? "hr_only";
  const busy = pending || isSubmitting;

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {!isEdit && (
        <Controller
          name="mode"
          control={control}
          render={({ field }) => (
            <Field label="Employee type" error={errors.mode?.message}>
              <Select {...field} disabled={busy}>
                <option value="hr_only">HR-only (no NexusOS login)</option>
                <option value="linked">Linked to my NexusOS account</option>
              </Select>
            </Field>
          )}
        />
      )}

      {mode === "linked" && !isEdit ? (
        <p className="rounded-control border border-line-soft bg-surface-3/50 px-3 py-2 text-sm text-muted-foreground">
          This employee will be linked to your signed-in NexusOS account. A tenant
          user directory API is not available yet — linking other users requires a
          future authorized backend addition.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName?.message}>
            <Input {...register("firstName")} autoComplete="given-name" disabled={busy} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input {...register("lastName")} autoComplete="family-name" disabled={busy} />
          </Field>
        </div>
      )}

      {(mode === "hr_only" || isEdit) && (
        <Field label="Work email" error={errors.workEmail?.message}>
          <Input type="email" {...register("workEmail")} autoComplete="email" disabled={busy} />
        </Field>
      )}

      <Field label="Employee number" required error={errors.employeeNumber?.message}>
        <Input {...register("employeeNumber")} disabled={busy || isEdit} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employment type" error={errors.employmentType?.message}>
          <Select {...register("employmentType")} disabled={busy}>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYMENT_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <Select {...register("status")} disabled={busy}>
            {EMPLOYEE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Department" error={errors.department?.message}>
        <Input {...register("department")} disabled={busy} />
      </Field>

      <Field label="Hire date" error={errors.hireDate?.message}>
        <Input type="date" {...register("hireDate")} disabled={busy} />
      </Field>

      <Field label="Manager" error={errors.managerId?.message}>
        <Select {...register("managerId")} disabled={busy}>
          <option value="">No manager</option>
          {managerOptions
            .filter((opt) => opt.id !== initial?.id)
            .map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.fullName} ({opt.employeeNumber})
              </option>
            ))}
        </Select>
      </Field>

      <CanEditCompensation>
        <Field label="Salary grade" error={errors.salaryGrade?.message}>
          <Input {...register("salaryGrade")} disabled={busy} />
        </Field>
      </CanEditCompensation>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function CanEditCompensation({ children }: { children: ReactNode }) {
  const canComp = usePermission("employees.read_compensation");
  const canCreate = usePermission("employees.create");
  return canComp || canCreate ? children : null;
}

export function formValuesToPayload(
  values: EmployeeFormValues,
  currentUserId: string | null,
  isEdit: boolean,
) {
  const base = {
    employeeNumber: values.employeeNumber.trim(),
    department: emptyToNull(values.department),
    managerId: values.managerId ? values.managerId : null,
    hireDate: emptyToNull(values.hireDate),
    salaryGrade: emptyToNull(values.salaryGrade),
    employmentType: values.employmentType,
    status: values.status,
  };

  if (isEdit) {
    return {
      ...base,
      firstName: emptyToNull(values.firstName),
      lastName: emptyToNull(values.lastName),
      workEmail: emptyToNull(values.workEmail),
    };
  }

  if (values.mode === "linked" && currentUserId) {
    return {
      ...base,
      userId: currentUserId,
    };
  }

  return {
    ...base,
    userId: null,
    firstName: values.firstName?.trim() ?? "",
    lastName: values.lastName?.trim() ?? "",
    workEmail: emptyToNull(values.workEmail),
  };
}
