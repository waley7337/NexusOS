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
  children: ReactElement;
  className?: string;
}

export function Field({ label, required, error, helper, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : helper ? `${id}-helper` : undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || undefined,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>{label}</Label>
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
