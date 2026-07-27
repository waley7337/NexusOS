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

const TONE_CLASSES: Record<SectionTone, string> = {
  primary: "bg-primary/70",
  success: "bg-success/70",
  warning: "bg-warning/70",
  danger: "bg-destructive/70",
  info: "bg-info/70",
  neutral: "bg-muted-foreground/40",
};

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  tone?: SectionTone;
  /** Heading level. Sections inside a page that already owns its h1 should
   *  stay at h3 (the default) so the document outline reads correctly. */
  as?: "h2" | "h3";
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  tone = "primary",
  as: Heading = "h3",
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
