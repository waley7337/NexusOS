import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { leadFormSchema, type LeadFormValues } from "../schemas/leadSchema";
import { leadToFormValues } from "../lib/leadFormValues";
import { PIPELINE_STAGE_LABELS } from "../lib/leadDisplay";
import { PIPELINE_STAGES, type Customer, type Lead } from "../types";

interface LeadFormProps {
  initial?: Lead | null;
  customers: Customer[];
  currentUserId: string | null;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: LeadFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function LeadForm({
  initial,
  customers,
  currentUserId,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: LeadFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: leadToFormValues(initial, currentUserId),
  });

  useEffect(() => {
    reset(leadToFormValues(initial, currentUserId));
  }, [initial, currentUserId, reset]);

  const busy = pending || isSubmitting;
  const showOtherAssigneeOption = Boolean(
    initial?.assignedTo &&
      currentUserId &&
      initial.assignedTo !== currentUserId,
  );

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field label="Customer" required error={errors.customerId?.message}>
        <Select {...register("customerId")} disabled={busy || customers.length === 0}>
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Pipeline stage" required error={errors.pipelineStage?.message}>
        <Select {...register("pipelineStage")} disabled={busy}>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {PIPELINE_STAGE_LABELS[stage]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Estimated value"
          helper="Amount only — no currency on this record"
          error={errors.estimatedValue?.message}
        >
          <Input
            {...register("estimatedValue")}
            inputMode="decimal"
            placeholder="0"
            disabled={busy}
          />
        </Field>
        <Field label="Probability (%)" error={errors.probability?.message}>
          <Input
            {...register("probability")}
            inputMode="numeric"
            placeholder="0–100"
            disabled={busy}
          />
        </Field>
      </div>

      <Field label="Expected close" error={errors.expectedCloseDate?.message}>
        <Input type="date" {...register("expectedCloseDate")} disabled={busy} />
      </Field>

      <Field
        label="Assignee"
        helper="Team member picker requires a members API (not available yet)."
        error={errors.assigneeMode?.message}
      >
        <Select {...register("assigneeMode")} disabled={busy || !currentUserId}>
          <option value="unassigned">Unassigned</option>
          {currentUserId ? <option value="me">Assign to me</option> : null}
          {showOtherAssigneeOption ? (
            <option value="other">Assigned to a teammate</option>
          ) : null}
        </Select>
      </Field>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} disabled={busy} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={customers.length === 0}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
