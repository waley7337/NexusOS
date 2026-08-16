/**
 * ShellStatusBar — the chassis' machine register (reconstructed, V3).
 *
 * Owns its own live clock subscription so AppLayout is not re-rendered
 * every second. Shares the singleton interval in useLiveClock.
 */
import { cn, formatRelativeTime } from "@/lib/utils";
import { useLiveClock } from "@/hooks/useLiveClock";
import type { ProbeState } from "@/hooks/useSystemStatus";
import type { StatusPillVariant } from "./status-pill";

interface ShellStatusBarProps {
  variant: StatusPillVariant;
  label: string;
  api: ProbeState;
  db: ProbeState;
  environment: string | null;
  lastSyncedAt: number | null;
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
  onCommandPalette,
  className,
}: ShellStatusBarProps) {
  const now = useLiveClock();
  const synced = lastSyncedAt ? formatRelativeTime(lastSyncedAt, now.getTime()) : null;

  return (
    <footer
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line-soft px-3 font-mono text-2xs font-medium tracking-[0.08em] text-muted-foreground md:px-5",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            DOT[variant],
            variant === "online" && "status-dot-alive text-success",
          )}
          aria-hidden="true"
        />

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
