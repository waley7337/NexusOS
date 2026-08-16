/**
 * SectionHeader — title + optional subtitle and trailing action, marked by a
 * short coloured tick (Part 04 convergence, Commit C).
 *
 * The tick is the point: a 3px rule in a semantic colour gives a section an
 * anchor and a category at a glance, without spending a heading level or a
 * border on it. Sections previously used CardTitle alone, which made every
 * panel on the dashboard read at identical weight.
 *
 * `tone` is decorative — it never encodes state on its own, so it carries no
 * accessible name. Anything that genuinely communicates status belongs in a
 * Badge or StatusPill where it gets a text equivalent.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SectionTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

/**
 * V1: the decorative rainbow is gone.
 *
 * `tone` is documented above as decorative — it never encodes state. A
 * decorative six-hue palette on structural furniture is precisely the
 * "rainbow visual language in product surfaces" the visual system rejects:
 * measured on the dashboard it painted a violet tick and a CYAN tick on two
 * adjacent section headers, neither of which meant anything.
 *
 * The type keeps all six names so no caller needs editing, but the four
 * state-coloured ones now resolve to neutral. Anything that genuinely
 * communicates status belongs in a Badge or StatusPill, where it gets a
 * text equivalent — which is what the component doc already said.
 */
const TONE_CLASSES: Record<SectionTone, string> = {
  primary: "bg-primary/60",
  neutral: "bg-muted-foreground/35",
  success: "bg-muted-foreground/35",
  warning: "bg-muted-foreground/35",
  danger: "bg-muted-foreground/35",
  info: "bg-muted-foreground/35",
};

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  tone?: SectionTone;
  /** Heading level. Defaults to h2: these are the top-level sections of a
   *  page whose only ancestor heading is the PageHeader h1, so h3 skipped a
   *  level and produced an outline of 1,3,3,3,3,3 (audited in Commit F).
   *  Pass h3 for a section genuinely nested inside another section. */
  as?: "h2" | "h3";
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  // V1: neutral by default. The tick was violet on every section header,
  // which put the accent on a purely structural element several times per
  // screen — accent as decoration, not as signal. Violet is now opt-in via
  // tone="primary" for a section that genuinely is the focal one.
  tone = "neutral",
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn("mt-[3px] h-4 w-[3px] shrink-0 rounded-full", TONE_CLASSES[tone])}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <Heading className="truncate text-sm font-semibold tracking-tight">{title}</Heading>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
