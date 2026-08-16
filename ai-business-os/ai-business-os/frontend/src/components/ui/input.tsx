/**
 * Input / Textarea / Select — §4.11
 * One visual language for all text-like controls: 10px radius, ring focus,
 * invalid state driven by aria-invalid (set by <Field>).
 */
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// V2: recessed, not floating. `bg-surface-2` sat at or above the page's
// own level, so a field read as a light rectangle placed ON the surface.
// A control you type into should read as cut INTO the chassis: it takes
// the darkest step on the ladder plus the inset edge-shade, so the top
// edge is in shadow rather than catching the key light — the inverse of a
// Plane, which is exactly the physical difference between a recess and a
// raised plate. Hover lifts the edge only; focus is handled by focus-edge.
const base =
  "w-full rounded-input border border-line-soft bg-surface-0 px-3 text-sm text-foreground shadow-[inset_0_1px_2px_0_var(--edge-shade)] [--focus-base:inset_0_1px_2px_0_var(--edge-shade)] transition-colors duration-fast placeholder:text-muted-foreground hover:border-line-strong focus-edge disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-soft aria-[invalid=true]:border-destructive aria-[invalid=true]:hover:border-destructive";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "min-h-20 py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-9 appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-[var(--icon-sm)] w-[var(--icon-sm)] -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";
