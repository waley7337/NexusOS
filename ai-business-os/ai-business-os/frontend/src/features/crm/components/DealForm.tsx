import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { dealFormSchema, type DealFormValues } from "../schemas/dealSchema";
import { dealToFormValues } from "../lib/dealFormValues";
import { DEAL_STATUS_LABELS } from "../lib/dealDisplay";
import { leadOptionLabel } from "../hooks/useLeadOptions";
import { DEAL_STATUSES, type Deal, type Lead } from "../types";

interface DealFormProps {
  mode: "create" | "edit";
  initial?: Deal | null;
  /** Create: available leads. Edit: not used for selection. */
  leadChoices: Lead[];
  customerNameById: Map<string, string>;
  /** Edit: display-only bound lead. */
  boundLead?: Lead | null;
  boundCustomerName?: string;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: DealFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function DealForm({
  mode,
  initial,
  leadChoices,
  customerNameById,
  boundLead,
  boundCustomerName,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: DealFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: dealToFormValues(initial),
  });

  useEffect(() => {
    reset(dealToFormValues(initial));
  }, [initial, reset]);

  const busy = pending || isSubmitting;
  const status = watch("status");

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      {mode === "create" ? (
        <Field label="Lead" required error={errors.leadId?.message}>
          <Select {...register("leadId")} disabled={busy || leadChoices.length === 0}>
            <option value="">Select a lead…</option>
            {leadChoices.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {leadOptionLabel(lead, customerNameById)}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="space-y-1.5 rounded-card border border-line-soft bg-surface-3/40 px-3 py-2.5">
          {/* Preserve leadId in form state for Zod; never expose as editable control. */}
          <input type="hidden" {...register("leadId")} />
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Lead
          </p>
          <p className="text-sm text-foreground">
            {boundLead
              ? leadOptionLabel(boundLead, customerNameById)
              : boundCustomerName
                ? `Lead · ${boundCustomerName}`
                : "Lead"}
          </p>
          <p className="text-xs text-muted-foreground">
            The lead relationship is set at creation and cannot be changed.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Value" required error={errors.value?.message}>
          <Input {...register("value")} inputMode="decimal" disabled={busy} />
        </Field>
        <Field
          label="Currency"
          required
          helper="ISO-3 code (e.g. USD, EUR)"
          error={errors.currency?.message}
        >
          <Input
            {...register("currency")}
            maxLength={3}
            className="uppercase"
            disabled={busy}
          />
        </Field>
      </div>

      <Field label="Status" required error={errors.status?.message}>
        <Select {...register("status")} disabled={busy}>
          {DEAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DEAL_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>

      {status === "won" && (
        <Field label="Won at" error={errors.wonAt?.message}>
          <Input type="datetime-local" {...register("wonAt")} disabled={busy} />
        </Field>
      )}

      {status === "lost" && (
        <Field label="Lost reason" error={errors.lostReason?.message}>
          <Textarea {...register("lostReason")} disabled={busy} />
        </Field>
      )}

      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={busy}
          disabled={mode === "create" && leadChoices.length === 0}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
