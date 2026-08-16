/**
 * Mission Control — cinematic product stage + dense system dashboard.
 *
 * TRUTHFULNESS IS UNCHANGED AND NON-NEGOTIABLE.
 * Values come only from auth identity, useLiveClock, and GET /health +
 * GET /ready. No KPI, revenue, pipeline, activity, or invented series.
 * Decorative waveforms are explicitly non-semantic ambient graphics.
 */
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Plus,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useScrollProductStage } from "@/hooks/useScrollProductStage";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { useDashboard } from "@/features/dashboard";
import { MODULE_SUMMARIES } from "@/features/dashboard/constants";
import { NAV_ITEMS, ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Plane } from "@/components/ui/structure";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function greetingAt(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const MODULES = NAV_ITEMS.filter((item) => item.to !== ROUTES.home);

const CAPABILITY_SECTIONS = [
  {
    id: "operations",
    title: "Business operations",
    body: "CRM, projects, tasks, finance, HR, inventory, and documents share one workspace identity — each module route is ready; service APIs land over time.",
  },
  {
    id: "ai",
    title: "AI operations",
    body: "The AI Assistant surface is routed and permission-aware. Conversational workflows activate when assistant services are connected.",
  },
  {
    id: "security",
    title: "Security architecture",
    body: "Tenant isolation, JWT sessions, and role-gated routes are live. Visual polish never changes authorization behavior.",
  },
] as const;

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const clock = useLiveClock();
  const { data, isPending, isError, dataUpdatedAt, refetch } = useDashboard();
  const setCaptureOpen = useUiStore((s) => s.setCaptureOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useScrollProductStage(!prefersReducedMotion);
  const storyRef = useRevealOnScroll<HTMLElement>();
  const modulesRef = useRevealOnScroll<HTMLElement>();

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const dateLabel = clock.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeLabel = clock.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const roleLabel = user?.role ? user.role.replace(/_/g, " ") : null;

  const apiOk = data?.apiStatus === "ok";
  const dbOk = data?.database === "ok";
  const probesPending = isPending && !isError;
  const motionAttr = prefersReducedMotion ? "reduce" : "full";

  const syncedLabel =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-10 pb-8">
      {/* ===== Cinematic product stage ===== */}
      <div
        ref={stageRef}
        className="product-stage-track"
        style={{ minHeight: prefersReducedMotion ? undefined : "118vh" }}
      >
        <div className="product-stage-sticky">
          <header
            className="product-hero mb-8 max-w-2xl space-y-4"
            data-motion={motionAttr}
          >
            <p className="text-sm font-medium text-primary/90">
              {user?.companyName ?? "NexusOS"}
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              {greetingAt(clock)}, {firstName}
            </h1>
            <p className="max-w-[42ch] text-base text-muted-foreground sm:text-lg">
              Operate your business from one intelligent system — CRM, projects,
              finance, operations, and AI in a single workspace.
            </p>
            <p className="text-sm text-muted-foreground">
              {dateLabel}
              {roleLabel ? ` · ${roleLabel}` : null}
              {user?.companySlug ? ` · ${user.companySlug}` : null}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={() => setCaptureOpen(true)}
                className="motion-respond hover:-translate-y-px"
              >
                <Plus /> Capture
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCommandPaletteOpen(true)}
                className="motion-respond hover:-translate-y-px"
              >
                Search workspace
              </Button>
            </div>
          </header>

          <div className="product-stage-frame" data-motion={motionAttr}>
            <div className="space-y-4 rounded-[var(--r-panel)] border border-[rgb(160_190_255_/_0.12)] bg-[hsl(var(--surface-1)/0.55)] p-3 shadow-[0_0_60px_-28px_var(--glow-blue)] sm:p-4">
              {/* Signal row */}
              <section
                aria-label="System signals"
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              >
                <SignalPanel
                  label="API"
                  pending={probesPending}
                  value={apiOk ? "Reachable" : isError ? "Unreachable" : "Unknown"}
                  hint={data?.environment ?? "liveness probe"}
                  tone={isError || (!probesPending && !apiOk) ? "bad" : apiOk ? "ok" : "muted"}
                />
                <SignalPanel
                  label="Database"
                  pending={probesPending}
                  value={dbOk ? "Ready" : "Unavailable"}
                  hint="readiness probe"
                  tone={dbOk ? "ok" : isError ? "muted" : "warn"}
                />
                <SignalPanel
                  label="Workspace"
                  pending={false}
                  value={user?.companyName ?? "—"}
                  hint={user?.email}
                  tone="ok"
                />
                <SignalPanel
                  label="Local time"
                  pending={false}
                  value={timeLabel}
                  hint={dateLabel}
                  tone="ok"
                />
              </section>

              {isError && (
                <p className="text-small text-muted-foreground">
                  Health probes did not respond.{" "}
                  <button
                    type="button"
                    className="focus-ring rounded text-foreground underline-offset-4 transition-colors duration-fast hover:text-primary hover:underline"
                    onClick={() => refetch()}
                  >
                    Retry
                  </button>
                </p>
              )}

              {/* Primary + secondary panels */}
              <section
                aria-label="Operations"
                className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
              >
                <Plane className="relative overflow-hidden p-5 sm:p-6">
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_70%_0%,hsl(var(--primary)/0.14),transparent_60%)]"
                    aria-hidden="true"
                  />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Operations
                      </p>
                      <h2 className="mt-2 text-h3 text-foreground">
                        No operational metrics yet
                      </h2>
                      <p className="mt-1.5 max-w-[48ch] text-body text-muted-foreground">
                        Revenue, pipeline, tasks, and activity appear here when
                        those modules have APIs. Nothing below is estimated.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-line-soft bg-surface-3/80 px-2.5 py-1 text-xs text-muted-foreground">
                      No metrics source
                    </span>
                  </div>

                  <AmbientWaveform />

                  <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button
                      type="button"
                      onClick={() => setCaptureOpen(true)}
                      className="focus-ring text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground"
                    >
                      Capture
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommandPaletteOpen(true)}
                      className="focus-ring text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground"
                    >
                      Search
                    </button>
                    <Link
                      to={ROUTES.design}
                      className="focus-ring text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground"
                    >
                      Design system
                    </Link>
                  </div>
                </Plane>

                <Plane className="relative flex flex-col overflow-hidden p-5 sm:p-6">
                  <div
                    className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,hsl(var(--accent-cyan)/0.18),transparent_70%)]"
                    aria-hidden="true"
                  />
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Readiness
                  </p>
                  <h2 className="mt-2 text-h3 text-foreground">Module field</h2>
                  <p className="mt-1.5 text-body text-muted-foreground">
                    Routes that exist today. Each opens an empty workspace until
                    its part ships.
                  </p>

                  <div className="mt-5 flex items-center gap-5">
                    <ReadinessRing
                      value={MODULES.length}
                      label="Configured"
                      sublabel="modules"
                    />
                    <dl className="min-w-0 flex-1 space-y-3">
                      <ReadinessRow
                        label="Operational modules"
                        value="0"
                        hint="no module APIs yet"
                      />
                      <ReadinessRow
                        label="Last probe"
                        value={syncedLabel ?? (probesPending ? "…" : "—")}
                        hint={
                          data?.environment
                            ? `env · ${data.environment}`
                            : "health + ready"
                        }
                      />
                      <ReadinessRow
                        label="Signed in as"
                        value={roleLabel ?? "—"}
                        hint={user?.name}
                      />
                    </dl>
                  </div>

                  <div className="mt-auto flex items-center gap-2 border-t border-line-soft pt-5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                        apiOk && dbOk
                          ? "bg-success text-success"
                          : isError
                            ? "bg-destructive text-destructive"
                            : "bg-warning text-warning",
                      )}
                      aria-hidden="true"
                    />
                    <p className="text-small text-muted-foreground">
                      {apiOk && dbOk
                        ? "System probes healthy"
                        : isError
                          ? "System probes unreachable"
                          : "Waiting on probes"}
                    </p>
                  </div>
                </Plane>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Module grid ===== */}
      <section
        ref={modulesRef}
        className="reveal-section space-y-4"
        aria-labelledby="band-modules"
      >
        <div className="flex items-center gap-3">
          <h2
            id="band-modules"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Modules
          </h2>
          <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">
            {MODULES.length} routes
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <ModuleTile
                key={item.to}
                to={item.to}
                label={item.label}
                description={MODULE_SUMMARIES[item.to]}
                icon={Icon}
              />
            );
          })}
        </div>
      </section>

      {/* ===== Lower product story ===== */}
      <section
        ref={storyRef}
        className="reveal-section space-y-6"
        aria-labelledby="band-story"
      >
        <div className="max-w-xl space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
            Platform
          </p>
          <h2
            id="band-story"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Built for unified operations
          </h2>
          <p className="text-muted-foreground">
            NexusOS keeps available capabilities, coming modules, and system
            truth clearly separated — so the product never invents progress.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {CAPABILITY_SECTIONS.map((section) => (
            <Plane key={section.id} className="p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-control border border-line-soft bg-surface-3/80 text-primary">
                {section.id === "ai" ? (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                ) : section.id === "security" ? (
                  <Shield className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {section.title}
              </h3>
              <p className="mt-2 text-small text-muted-foreground">
                {section.body}
              </p>
            </Plane>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalPanel({
  label,
  value,
  hint,
  pending,
  tone,
}: {
  label: string;
  value?: string;
  hint?: string;
  pending: boolean;
  tone: "ok" | "warn" | "bad" | "muted";
}) {
  return (
    <Plane className="relative overflow-hidden p-4 sm:p-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        aria-hidden="true"
      />
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-3">
        {pending ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p
            className={cn(
              "text-xl font-semibold tracking-tight",
              tone === "ok" && "text-foreground",
              tone === "warn" && "text-warning",
              tone === "bad" && "text-destructive",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {value ?? "—"}
          </p>
        )}
        {hint && !pending && (
          <p className="mt-1 truncate text-small text-muted-foreground">{hint}</p>
        )}
      </div>
    </Plane>
  );
}

function ReadinessRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        {hint && (
          <p className="mt-0.5 truncate text-small text-disabled-foreground">
            {hint}
          </p>
        )}
      </div>
      <dd className="shrink-0 text-sm font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

/** Decorative readiness ring — count of configured routes, not analytics. */
function ReadinessRing({
  value,
  label,
  sublabel,
}: {
  value: number;
  label: string;
  sublabel: string;
}) {
  const circumference = 2 * Math.PI * 36;
  const progress = Math.min(1, value / 12);
  const dash = circumference * progress;

  return (
    <div className="relative h-[5.5rem] w-[5.5rem] shrink-0" aria-hidden="true">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="7"
          className="text-foreground"
        />
        <circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="drop-shadow-[0_0_8px_var(--glow-blue)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">
          {label}
          <br />
          {sublabel}
        </span>
      </div>
    </div>
  );
}

/**
 * Ambient waveform — decorative only.
 * Not a chart of business data. No axis labels implying metrics.
 */
function AmbientWaveform() {
  return (
    <div
      className="relative mt-6 h-44 overflow-hidden rounded-[var(--r-surface)] border border-line-soft bg-surface-0/50 sm:h-52"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_100%,hsl(var(--primary)/0.18),transparent_55%)]" />
      <svg
        viewBox="0 0 640 208"
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="nx-wave-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
          <filter id="nx-wave-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[48, 88, 128, 168].map((y) => (
          <line
            key={y}
            x1="24"
            x2="616"
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.06"
            className="text-foreground"
          />
        ))}
        <path
          d="M24 148 C 90 148, 110 72, 180 96 S 280 168, 340 120 S 440 48, 500 88 S 580 140, 616 112 V 190 H 24 Z"
          fill="url(#nx-wave-fill)"
        />
        <path
          d="M24 148 C 90 148, 110 72, 180 96 S 280 168, 340 120 S 440 48, 500 88 S 580 140, 616 112"
          fill="none"
          stroke="hsl(var(--primary-soft))"
          strokeWidth="2.25"
          filter="url(#nx-wave-glow)"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-line-soft bg-surface-2/90 px-3 py-1.5 backdrop-blur-sm">
          <LayoutDashboard className="h-3.5 w-3.5 text-disabled-foreground" />
          <span className="text-xs text-muted-foreground">
            Ambient preview · not operational data
          </span>
        </div>
      </div>
    </div>
  );
}

function ModuleTile({
  to,
  label,
  description,
  icon: Icon,
}: {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="surface motion-respond group focus-ring block p-4 transition-[border-color,background-color,transform] duration-fast hover:-translate-y-px hover:border-line-strong hover:bg-surface-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-control border border-line-soft bg-surface-3/70">
              <Icon
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-fast group-hover:text-primary"
                aria-hidden="true"
              />
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <p className="mt-2.5 line-clamp-2 text-small text-muted-foreground">
            {description}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line-soft bg-surface-0/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Not operational
        </span>
      </div>
    </Link>
  );
}
