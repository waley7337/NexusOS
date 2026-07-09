/** Label — §4.11. Required fields show an asterisk with an accessible name. */
import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-destructive" aria-label="required">*</span>
      )}
    </label>
  ),
);
Label.displayName = "Label";
