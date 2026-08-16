/**
 * ShellStatusBar — the chassis' machine register (reconstructed, V3).
 *
 * This is the product's natural home for V1's mono machine language: every
 * value here is something a machine reported, and none of it is prose.
 *
 * V3 changes what it SAYS, not where it lives. It used to collapse the whole
 * system into one sentence ("Connected", "Database unavailable") next to a
 * coloured dot — a status widget. It now reads as instrumentation:
 *
 *     ● API / READY    DB / READY    ENV / PRODUCTION      14:22:01   ⌘K
 *
 * Rules this follows:
 *  - Truth only. Every segment comes from useSystemStatus, which derives
 *    from GET /health + GET /ready and navigator.onLine. A probe that has
 *    not resolved renders "—", not a guess, because "unknown" and "down"
 *    are different facts.
 *  - ENV renders only when the API actually reported one.
 *  - Healthy is QUIET: neutral text, no colour, so a nominal system never
 *    competes with product content. Only degradation earns colour, which is
 *    the one case where the register should pull the eye.
 *  - The chassis is separated from content by the rail and a hairline, not
 *    by a fill.
 *
 * A11y (unchanged from the previous version):
 *  - one role="status" aria-live="polite" region carrying the human summary,
 *    so a screen reader hears "Database unavailable", not "DB slash DOWN";
 *  - the per-segment register is aria-hidden — it is a visual restatement of
 *    that same summary, and announcing both would double every change;
 *  - the clock is aria-hidden (a per-second live region is noise);
 *  - ⌘K is a real button, reachable and operable by keyboard.
 */
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ProbeState } from "@/hooks/useSystemStatus";
import type { StatusPillVariant } from "./status-pill";

interface ShellStatusBarProps {
  variant: StatusPillVariant;
  label: string;
  api: ProbeState;
  db: ProbeState;
  environment: string | null;
  lastSyncedAt: number | null;
  /** Current time — passed in so the whole shell shares one ticking clock. */
  now: Date;
  onCommandPalette: () => void;
  className?: string;
}

const PROBE_TEXT: Record<ProbeState, string> = {
  ok: "READY",
  down: "DOWN",
  unknown: "—",
};

const DOT: Record<StatusPillVariant, string> = {
  online: "bg-success",
  warning: "bg-warning",
  offline: "bg-destructive",
};

/** One instrument segment. Neutral unless the probe is actually down. */
function Segment({ name, state }: { name: string; state: ProbeState }) {
  return (
    <span className="hidden items-center gap-1 sm:inline-flex">
      {/* V8: muted, not disabled. --disabled-foreground measured 3.94:1
          against the chassis here — below AA. The register is quiet by
          being small and mono, not by being dim to the point of failing. */}
      <span className="text-muted-foreground">{name}</span>
      <span className="text-muted-foreground">/</span>
      <span className={cn(state === "down" ? "text-destructive" : "text-muted-foreground")}>
        {PROBE_TEXT[state]}
      </span>
    </span>
  );
}

export function ShellStatusBar({
  variant,
  label,
  api,
  db,
  environment,
  lastSyncedAt,
  now,
  onCommandPalette,
  className,
}: ShellStatusBarProps) {
  const synced = lastSyncedAt ? formatRelativeTime(lastSyncedAt, now.getTime()) : null;

  return (
    <footer
      className={cn(
        // No fill: the register is part of the chassis, separated by a
        // hairline and the rail rather than by another filled bar.
        "flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line-soft px-3 font-mono text-2xs font-medium tracking-[0.08em] text-muted-foreground md:px-5",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* The dot is the only colour, and the only thing that survives at
            the narrowest width. */}
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            DOT[variant],
            variant === "online" && "status-dot-alive text-success",
          )}
          aria-hidden="true"
        />

        {/* Screen readers get the human summary, once. */}
        <span role="status" aria-live="polite" className="sr-only">
          {label}
        </span>

        <span className="flex min-w-0 items-center gap-3 truncate tabular-nums" aria-hidden="true">
          <Segment name="API" state={api} />
          <Segment name="DB" state={db} />
          {environment && (
            <span className="hidden items-center gap-1 lg:inline-flex">
              <span className="text-muted-foreground">ENV</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{environment.toUpperCase()}</span>
            </span>
          )}
          {/* Below sm the segments are hidden; the summary carries it. */}
          <span className="truncate sm:hidden">{label.toUpperCase()}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3 tabular-nums">
        {synced && <span className="hidden md:inline">SYNC / {synced.toUpperCase()}</span>}

        <span className="hidden lg:inline" aria-hidden="true">
          {now.toLocaleTimeString([], { hour12: false })}
        </span>

        <button
          type="button"
          onClick={onCommandPalette}
          className="focus-ring -mx-1.5 -my-1.5 rounded px-1.5 py-1.5 transition-colors duration-fast hover:text-foreground"
        >
          <span aria-hidden="true">⌘K</span>
          <span className="sr-only">Open the command palette</span>
        </button>
      </div>
    </footer>
  );
}
