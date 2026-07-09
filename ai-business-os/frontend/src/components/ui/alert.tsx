/** Alert — inline callout. Semantic variants mirror toast types (§4.19). */
import { type HTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-card border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/30 bg-info/5 [&_svg]:text-info",
      success: "border-success/30 bg-success/5 [&_svg]:text-success",
      warning: "border-warning/40 bg-warning/10 [&_svg]:text-warning",
      danger: "border-destructive/30 bg-destructive/5 [&_svg]:text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium leading-none">{title}</p>
        {children && <p className="text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}
