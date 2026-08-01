/**
 * PageHeader — the one shared top-of-page block every module inherits
 * (Part 04, Phase 4). Title renders at .text-display: the one Display-scale
 * focal point per page (Design Constitution principle 2).
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Small label above the title (breadcrumb-adjacent context). */
  eyebrow?: string;
  title: string;
  /** The line under the title that gives it context. Accepts a ReactNode so
   * callers can emphasize part of it (e.g. a highlighted phrase). */
  description?: ReactNode;
  /** Right-aligned controls next to the title (buttons). */
  actions?: ReactNode;
  /** Reserved for Phase 5's StatusPill/live-clock — renders beside the eyebrow. */
  status?: ReactNode;
  /** Heading level — "h1" (default) for real pages. "h2" exists only so a
   * page that already has its own h1 (e.g. /design's demo) can render this
   * component without producing a second page-level heading. */
  as?: "h1" | "h2";
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, status, as: Heading = "h1", className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(eyebrow || status) && (
        <div className="flex items-center justify-between gap-3">
          {eyebrow ? <p className="text-caption">{eyebrow}</p> : <span />}
          {status && <div className="shrink-0">{status}</div>}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* tabIndex=-1: useRouteFocus() moves focus to the page's h1 on route
            change (§5.19). focus:outline-none suppresses the platform ring
            that programmatic focus would otherwise paint around the heading.
            Safe: tabIndex={-1} means this is not reachable with Tab, so no
            keyboard user ever needs an indicator here — every genuinely
            interactive control keeps its focus-visible ring. */}
        <Heading className="text-display focus:outline-none" tabIndex={-1}>
          {title}
        </Heading>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {description && <p className="max-w-2xl text-body-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
