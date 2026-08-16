/**
 * Button — §4.10
 * Purpose: every action in NexusOS. Variant = intent, size = context.
 * States: hover, pressed (active), disabled, loading, focus-visible.
 * A11y: loading sets aria-busy and disables interaction; focus ring always visible.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-fast ease-out-quart focus-edge disabled:pointer-events-none disabled:opacity-40 active:brightness-[0.92] [&_svg]:h-[var(--icon-sm)] [&_svg]:w-[var(--icon-sm)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // primary uses --primary-fill (#5B51E8), not --primary. The accent
        // violet is tuned for legibility AS text on near-black; white on it is
        // only 3.62:1. The deep fill carries a white label at 5.49:1.
        // shadow-inset is the top "lip" highlight that makes a filled control
        // read as a physical key rather than a flat rectangle.
        primary: "bg-primary-fill text-white hover:bg-primary-fill/90 shadow-inset",
        secondary: "bg-surface-4 text-foreground hover:bg-surface-5 border border-line-soft shadow-inset",
        outline: "border border-line-soft bg-transparent hover:bg-surface-4 hover:border-line-strong",
        ghost: "hover:bg-surface-4",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-inset",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-inset",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };
