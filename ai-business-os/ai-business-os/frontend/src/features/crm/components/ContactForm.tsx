import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { contactFormSchema, type ContactFormValues } from "../schemas/contactSchema";
import { contactToFormValues } from "../lib/contactFormValues";
import type { Contact, Customer } from "../types";

interface ContactFormProps {
  initial?: Contact | null;
  customers: Customer[];
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: ContactFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function ContactForm({
  initial,
  customers,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactToFormValues(initial),
  });

  useEffect(() => {
    reset(contactToFormValues(initial));
  }, [initial, reset]);

  const busy = pending || isSubmitting;

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName?.message}>
          <Input {...register("firstName")} autoComplete="given-name" disabled={busy} />
        </Field>
        <Field label="Last name" required error={errors.lastName?.message}>
          <Input {...register("lastName")} autoComplete="family-name" disabled={busy} />
        </Field>
      </div>

      <Field label="Position" error={errors.position?.message}>
        <Input {...register("position")} disabled={busy} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} autoComplete="email" disabled={busy} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input type="tel" {...register("phone")} autoComplete="tel" disabled={busy} />
        </Field>
      </div>

      <Field label="LinkedIn" error={errors.linkedin?.message}>
        <Input {...register("linkedin")} inputMode="url" disabled={busy} />
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
