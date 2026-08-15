/**
 * ShellStatusBar — the persistent monospace status strip across the bottom of
 * the application shell (Part 04 convergence, Commit C).
 *
 * Replaces the status block that previously sat in the sidebar footer; the
 * status is deliberately rendered in exactly one place. Sitting at the foot of
 * the shell rather than inside the sidebar means it stays visible and
 * correctly positioned whether the sidebar is expanded, collapsed, or (on
 * mobile) not rendered at all, because it lives in the content column.
 *
 * Data: every value comes from a real source — useSystemStatus (navigator.onLine
 * plus the dashboard health/ready snapshot cache) and useLiveClock. Nothing
 * here is a hardcoded "operational" string.
 *
 * A11y:
 *  - the status region is role="status" aria-live="polite", so a screen-reader
 *    user is told when the system degrades or recovers, without the update
 *    stealing focus;
 *  - the clock is aria-hidden — a per-second live region would flood a
 *    screen reader with meaningless announcements;
 *  - the ⌘K affordance is a real <button>, reachable and operable by keyboard,
 *    not a decorative keycap.
 */
import { Clock } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { StatusPill, type StatusPillVariant } from "./status-pill";

interface ShellStatusBarProps {
  variant: StatusPillVariant;
  label: string;
  lastSyncedAt: number | null;
  /** Current time — passed in so the whole shell shares one ticking clock. */
  now: Date;
  onCommandPalette: () => void;
  className?: string;
}

export function ShellStatusBar({
  variant,
  label,
  lastSyncedAt,
  now,
  onCommandPalette,
  className,
}: ShellStatusBarProps) {
  const synced = lastSyncedAt ? formatRelativeTime(lastSyncedAt, now.getTime()) : null;

  return (
    <footer
      className={cn(
        // shrink-0 keeps the bar at its intrinsic height inside the shell's
        // flex column; pb env() clears the iOS home indicator.
        // shrink-0 keeps the bar at its intrinsic height inside the shell's
        // flex column; pb env() clears the iOS home indicator. border-line-soft
        // is the Tailwind utility for the same --line-soft token previously
        // set via inline style — presentation only, no behaviour change.
        "flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line-soft px-4 font-mono text-2xs text-muted-foreground backdrop-blur",
        className,
      )}
      style={{
        backgroundColor: "hsl(var(--surface-1) / 0.8)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div role="status" aria-live="polite" className="min-w-0 truncate">
          <StatusPill variant={variant} label={label} />
        </div>

        {synced && (
          <span className="num hidden truncate sm:inline">Synced {synced}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="num hidden items-center gap-1.5 md:inline-flex" aria-hidden="true">
          <Clock className="h-3 w-3" />
          {now.toLocaleTimeString([], { hour12: false })}
        </span>

        <button
          type="button"
          onClick={onCommandPalette}
          className="focus-ring inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground"
        >
          {/* The glyph is the affordance — pairing a Command icon with the
              literal "⌘K" rendered the symbol twice in a row. */}
          <span className="num">⌘K</span>
          <span className="sr-only">Open the command palette</span>
        </button>
      </div>
    </footer>
  );
}
