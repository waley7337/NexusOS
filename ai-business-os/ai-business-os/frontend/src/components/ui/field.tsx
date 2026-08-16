/**
 * Field — §4.11 composition: Label + control + helper/error.
 * Wires id / aria-describedby / aria-invalid so validation is announced
 * by screen readers, not just colored red.
 */
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  helper?: string;
  /** Optional control aligned with the label (e.g. a forgot-password link). */
  labelAccessory?: ReactNode;
  children: ReactElement;
  className?: string;
}

export function Field({ label, required, error, helper, labelAccessory, children, className }: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, !error && helper ? `${id}-helper` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-errormessage": error ? `${id}-error` : undefined,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      {labelAccessory ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id} required={required}>{label}</Label>
          {labelAccessory}
        </div>
      ) : (
        <Label htmlFor={id} required={required}>{label}</Label>
      )}
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
