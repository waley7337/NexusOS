/**
 * Mission Control — cinematic product stage + dense system dashboard.
 *
 * TRUTHFULNESS IS UNCHANGED AND NON-NEGOTIABLE.
 * Values come only from auth identity, useLiveClock, and GET /health +
 * GET /ready. No KPI, revenue, pipeline, activity, or invented series.
 * Decorative waveforms are explicitly non-semantic ambient graphics.
 */
import { Link } from "react-router-dom";
import { useState } from "react";
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
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { useDashboard } from "@/features/dashboard";
import { useDashboardMetrics } from "@/features/dashboard";
import { MODULE_SUMMARIES } from "@/features/dashboard/constants";
import { discoverableNavItems, NAV_ITEMS, ROUTES } from "@/constants/routes";
import { useAuthMe } from "@/hooks/usePermission";
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
  const { data, isPending, isError, dataUpdatedAt, refetch } = useDashboard();
  const {
    data: metrics,
    isPending: metricsPending,
    isError: metricsError,
  } = useDashboardMetrics();
  const setCaptureOpen = useUiStore((s) => s.setCaptureOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const prefersReducedMotion = useReducedMotion();
  const storyRef = useRevealOnScroll<HTMLElement>();
  const modulesRef = useRevealOnScroll<HTMLElement>();
  const { data: me } = useAuthMe();
  const modules = discoverableNavItems(NAV_ITEMS, me?.permissions).filter(
    (item) => item.to !== ROUTES.home,
  );

  /* One-shot cinema after auth entry — never replay on later module visits. */
  const [cinemaEntry] = useState(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return false;
    }
    const pending = useUiStore.getState().pendingCinematicReveal;
    if (pending) useUiStore.getState().clearCinematicReveal();
    return pending;
  });

  const firstName = user?.name?.split(" ")[0] ?? "there";
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
    <div
      className={cn("space-y-10 pb-8", cinemaEntry && "cinema-entry")}
      data-cinema={cinemaEntry ? "entry" : undefined}
    >
      {/* ===== Mission Control (native scroll — no sticky scroll-stage) ===== */}
      <div className="product-stage-track">
        <div className="product-stage-sticky">
          <header
            className="product-hero mb-8 max-w-2xl space-y-4"
            data-motion={motionAttr}
          >
            <div className="cinema-hero space-y-4">
            <p className="text-sm font-medium text-primary/90">
              {user?.companyName ?? "NexusOS"}
            </p>
            <DashboardGreeting firstName={firstName} />
            <p className="max-w-[42ch] text-base text-muted-foreground sm:text-lg">
              Operate your business from one intelligent system — CRM, projects,
              finance, operations, and AI in a single workspace.
            </p>
            <DashboardMeta
              roleLabel={roleLabel}
              companySlug={user?.companySlug}
            />
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
            </div>
          </header>

          <div className="product-stage-frame" data-motion={motionAttr}>
            <div className="mission-primary cinema-stage space-y-4 rounded-[var(--r-panel)] border border-[rgb(160_190_255_/_0.14)] bg-[hsl(var(--surface-1)/0.78)] p-3 shadow-[0_1px_0_0_rgb(180_210_255_/_0.08)_inset] sm:p-4">
              {/* Signal row */}
              <section
                aria-label="System signals"
                className="cinema-signals grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
                <LocalTimeSignal />
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
                className="cinema-ops grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"
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
                      {metricsPending ? (
                        <Skeleton className="mt-2 h-7 w-40" />
                      ) : metricsError || !metrics ? (
                        <h2 className="mt-2 text-h3 text-foreground">
                          Metrics unavailable
                        </h2>
                      ) : (
                        <h2 className="mt-2 text-h3 text-foreground">
                          {metrics.finance.openInvoiceCount > 0
                            ? `${metrics.finance.openInvoiceCount} open invoice${metrics.finance.openInvoiceCount !== 1 ? "s" : ""}`
                            : metrics.crm.customerCount > 0
                              ? `${metrics.crm.customerCount} customer${metrics.crm.customerCount !== 1 ? "s" : ""}`
                              : metrics.projects.activeProjectCount > 0
                                ? `${metrics.projects.activeProjectCount} active project${metrics.projects.activeProjectCount !== 1 ? "s" : ""}`
                                : "All clear"}
                        </h2>
                      )}
                      {metricsPending ? (
                        <Skeleton className="mt-1.5 h-4 w-60" />
                      ) : metricsError || !metrics ? (
                        <p className="mt-1.5 max-w-[48ch] text-body text-muted-foreground">
                          Could not load operational metrics. They will appear once the database is reachable.
                        </p>
                      ) : (
                        <p className="mt-1.5 max-w-[48ch] text-body text-muted-foreground">
                          Live data as of today · {metrics.asOf}. Nothing here is estimated.
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-line-soft bg-surface-3/80 px-2.5 py-1 text-xs text-muted-foreground">
                      {metricsPending ? "Loading…" : metricsError ? "Unavailable" : "Live"}
                    </span>
                  </div>

                  {/* Metrics grid — loading skeleton / real values / error placeholder */}
                  <div className="relative mt-5">
                    {metricsPending ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="rounded-[var(--r-surface)] border border-line-soft bg-surface-0/50 px-3 py-2.5">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="mt-1.5 h-5 w-10" />
                          </div>
                        ))}
                      </div>
                    ) : metricsError || !metrics ? (
                      <AmbientWaveform />
                    ) : (
                      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <MetricChip
                          label="Open invoices"
                          value={metrics.finance.openInvoiceCount}
                          warn={metrics.finance.overdueInvoiceCount > 0}
                          hint={
                            metrics.finance.overdueInvoiceCount > 0
                              ? `${metrics.finance.overdueInvoiceCount} overdue`
                              : undefined
                          }
                        />
                        <MetricChip
                          label="Customers"
                          value={metrics.crm.customerCount}
                        />
                        <MetricChip
                          label="Open leads"
                          value={metrics.crm.openLeadCount}
                        />
                        <MetricChip
                          label="Active projects"
                          value={metrics.projects.activeProjectCount}
                        />
                        <MetricChip
                          label="Open tasks"
                          value={metrics.projects.openTaskCount}
                          warn={metrics.projects.overdueTaskCount > 0}
                          hint={
                            metrics.projects.overdueTaskCount > 0
                              ? `${metrics.projects.overdueTaskCount} overdue`
                              : undefined
                          }
                        />
                        <MetricChip
                          label="Employees"
                          value={metrics.hr.employeeCount}
                        />
                      </dl>
                    )}
                  </div>

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
                    Configured routes in this workspace. CRM Customers is live;
                    other modules open as honest empty surfaces until their APIs
                    ship.
                  </p>

                  <div className="mt-5 flex items-center gap-5">
                    <ReadinessRing
                      value={modules.length}
                      label="Configured"
                      sublabel="modules"
                    />
                    <dl className="min-w-0 flex-1 space-y-3">
                      <ReadinessRow
                        label="Operational modules"
                        value="6"
                        hint="CRM · HR · Finance · Inventory · Projects · Tasks"
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
                        "h-1.5 w-1.5 rounded-full",
                        apiOk && dbOk
                          ? "status-dot-alive bg-success text-success"
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
            {modules.length} routes
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => {
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

function DashboardGreeting({ firstName }: { firstName: string }) {
  const clock = useLiveClock();
  return (
    <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
      {greetingAt(clock)}, {firstName}
    </h1>
  );
}

function DashboardMeta({
  roleLabel,
  companySlug,
}: {
  roleLabel: string | null;
  companySlug?: string | null;
}) {
  const clock = useLiveClock();
  const dateLabel = clock.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <p className="text-sm text-muted-foreground">
      {dateLabel}
      {roleLabel ? ` · ${roleLabel}` : null}
      {companySlug ? ` · ${companySlug}` : null}
    </p>
  );
}

function LocalTimeSignal() {
  const clock = useLiveClock();
  const timeLabel = clock.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = clock.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <SignalPanel
      label="Local time"
      pending={false}
      value={timeLabel}
      hint={dateLabel}
      tone="ok"
    />
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

/** Single metric chip shown in the Operations panel. */
function MetricChip({
  label,
  value,
  warn,
  hint,
}: {
  label: string;
  value: number;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--r-surface)] border border-line-soft bg-surface-0/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums leading-tight",
          warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </dd>
      {hint && (
        <p className="mt-0.5 text-[10px] leading-tight text-disabled-foreground">
          {hint}
        </p>
      )}
    </div>
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
 * Transform-only phase motion — no SVG feGaussianBlur (paint cost).
 */
function AmbientWaveform() {
  return (
    <div
      className="relative mt-6 h-44 overflow-hidden rounded-[var(--r-surface)] border border-line-soft bg-surface-0/50 sm:h-52"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_100%,hsl(var(--primary)/0.18),transparent_55%)]" />
      <div className="ambient-wave-phase absolute inset-[-2%_-3%]">
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
            strokeOpacity="0.85"
            className="ambient-wave-sheen"
            strokeDasharray="8 14"
          />
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-line-soft bg-surface-2/90 px-3 py-1.5">
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
  // Modules with confirmed backend ↔ frontend integration
  const OPERATIONAL_ROUTES = new Set<string>([
    ROUTES.crm,
    ROUTES.hr,
    ROUTES.finance,
    ROUTES.inventory,
    ROUTES.projects,
    ROUTES.tasks,
  ]);
  const operational = OPERATIONAL_ROUTES.has(to);
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
          {operational ? "Operational" : "Not operational"}
        </span>
      </div>
    </Link>
  );
}
