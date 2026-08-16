import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Semantic tokens throughout (Part 04 convergence, Commit C). The previous
// variants used raw palette classes (emerald-500 / amber-500 / red-500 /
// blue-500), which bypassed the token system entirely — they did not follow
// the Commit A colour retune and had no relationship to --success/--warning/
// --destructive/--info. The tinted fill + matching hairline is what gives a
// badge weight on a near-black surface without shouting.
// V2: de-pilled. rounded-full made every badge read as a chip from a
// component library; the control radius makes it read as a machined tag
// belonging to the same object family as buttons and inputs. Uppercase
// mono puts it in the machine register — a badge almost always reports a
// state a system computed, not a phrase a human wrote. The tinted fill +
// matching hairline is kept: it is what gives a badge weight on near-black
// without shouting.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-control border px-1.5 py-0.5 font-mono text-2xs font-medium uppercase tracking-[0.08em] tabular-nums",
  {
    variants: {
      variant: {
        default: "border-line bg-surface-4 text-muted-foreground",
        accent: "border-primary/25 bg-primary/10 text-primary",
        success: "border-success/25 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/10 text-warning",
        danger: "border-destructive/25 bg-destructive/10 text-destructive",
        info: "border-info/25 bg-info/10 text-info",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
