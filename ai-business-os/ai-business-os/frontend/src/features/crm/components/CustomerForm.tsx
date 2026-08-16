import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { customerFormSchema, type CustomerFormValues } from "../schemas/customerSchema";
import { CUSTOMER_STATUSES, type Customer } from "../types";
import { customerToFormValues } from "../lib/customerFormValues";

const STATUS_LABELS: Record<(typeof CUSTOMER_STATUSES)[number], string> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
  churned: "Churned",
};

interface CustomerFormProps {
  initial?: Customer | null;
  currentUserId: string | null;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function CustomerForm({
  initial,
  currentUserId,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: customerToFormValues(initial, currentUserId),
  });

  useEffect(() => {
    reset(customerToFormValues(initial, currentUserId));
  }, [initial, currentUserId, reset]);

  const busy = pending || isSubmitting;

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Company name" required error={errors.companyName?.message}>
        <Input {...register("companyName")} autoComplete="organization" disabled={busy} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={errors.status?.message}>
          <Select {...register("status")} disabled={busy}>
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Industry" error={errors.industry?.message}>
          <Input {...register("industry")} disabled={busy} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} autoComplete="email" disabled={busy} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register("phone")} autoComplete="tel" disabled={busy} />
        </Field>
      </div>

      <Field label="Website" error={errors.website?.message}>
        <Input {...register("website")} inputMode="url" disabled={busy} />
      </Field>

      <Field label="Address" error={errors.address?.message}>
        <Input {...register("address")} autoComplete="street-address" disabled={busy} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" error={errors.city?.message}>
          <Input {...register("city")} autoComplete="address-level2" disabled={busy} />
        </Field>
        <Field label="Country" error={errors.country?.message}>
          <Input {...register("country")} autoComplete="country-name" disabled={busy} />
        </Field>
      </div>

      <Field label="Source" error={errors.source?.message}>
        <Input {...register("source")} disabled={busy} />
      </Field>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} disabled={busy} />
      </Field>

      {currentUserId && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line-soft"
            {...register("assignMeAsOwner")}
            disabled={busy}
          />
          Assign me as owner
        </label>
      )}

      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
