/**
 * Dashboard — Mission Control.
 *
 * Only real signals: auth identity, live clock, navigator.onLine (via the
 * shell), and GET /health + GET /ready. Business charts, KPIs, activity,
 * meetings, and AI insights are omitted until those APIs exist.
 *
 * Entry motion is Phase C's route surface (220ms). This page does not add
 * a second reveal, blur sweep, or section stagger.
 */
import { Link } from "react-router-dom";
import { LayoutDashboard, Plus, Search } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useDashboard } from "@/features/dashboard";
import { MODULE_SUMMARIES } from "@/features/dashboard/constants";
import { NAV_ITEMS, ROUTES } from "@/constants/routes";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function greetingAt(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const MODULES = NAV_ITEMS.filter((item) => item.to !== ROUTES.home);

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const clock = useLiveClock();
  const { data, isPending, isError, refetch } = useDashboard();
  const setCaptureOpen = useUiStore((s) => s.setCaptureOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const dateLabel = clock.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const roleLabel = user?.role ? user.role.replace(/_/g, " ") : null;

  const apiOk = data?.apiStatus === "ok";
  const dbOk = data?.database === "ok";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={user?.companyName ?? "NexusOS"}
        title={`${greetingAt(clock)}, ${firstName}`}
        description={
          <>
            {dateLabel}
            {roleLabel ? ` · ${roleLabel}` : null}
            {user?.companySlug ? ` · ${user.companySlug}` : null}
          </>
        }
        actions={
          <Button onClick={() => setCaptureOpen(true)}>
            <Plus /> Capture
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="order-2 lg:order-1 lg:col-span-5" aria-label="System">
          <SectionHeader
            as="h2"
            title="System"
            subtitle="API liveness and database readiness for this workspace."
            tone="info"
          />
          <dl className="mt-4 grid overflow-hidden rounded-xl border border-line-soft sm:grid-cols-3">
            <Signal
              label="API"
              pending={isPending}
              failed={isError}
              value={apiOk ? "Reachable" : isError ? "Unreachable" : "Unknown"}
              hint={data?.environment}
              tone={isError ? "danger" : apiOk ? "ok" : "muted"}
            />
            <Signal
              label="Database"
              pending={isPending}
              failed={isError}
              value={dbOk ? "Ready" : isPending ? undefined : "Unavailable"}
              tone={dbOk ? "ok" : isPending || isError ? "muted" : "warn"}
            />
            <Signal
              label="Workspace"
              pending={false}
              failed={false}
              value={user?.companyName ?? "—"}
              hint={user?.email}
              tone="ok"
            />
          </dl>
          {isError && (
            <p className="mt-3 text-sm text-muted-foreground">
              Health probes did not respond.{" "}
              <button
                type="button"
                className="focus-ring rounded text-foreground underline-offset-4 hover:underline"
                onClick={() => refetch()}
              >
                Retry
              </button>
            </p>
          )}
        </section>

        <section className="order-1 lg:order-2 lg:col-span-2" aria-label="Priorities">
          <SectionHeader
            as="h2"
            title="Priorities"
            subtitle="What you can do in this workspace today."
            tone="primary"
          />
          <div className="mt-4">
            <EmptyState
              icon={LayoutDashboard}
              title="No operational metrics yet"
              description="Revenue, pipeline, tasks, and activity will appear here when those modules have APIs. Nothing below is estimated."
            >
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCaptureOpen(true)}>
                  <Plus /> Capture
                </Button>
                <Button variant="outline" onClick={() => setCommandPaletteOpen(true)}>
                  <Search /> Search
                </Button>
                <Link to={ROUTES.design} className={buttonVariants({ variant: "ghost" })}>
                  Design system
                </Link>
              </div>
            </EmptyState>
          </div>
        </section>

        <section className="order-3 lg:order-3 lg:col-span-3" aria-label="Modules">
          <SectionHeader
            as="h2"
            title="Modules"
            subtitle="Routes that exist today. Each opens an empty workspace until its part ships."
            tone="neutral"
          />
          <ul className="mt-4 divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
            {MODULES.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="focus-ring flex items-start gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-3/60"
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-4 text-muted-foreground"
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                          Not operational
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {MODULE_SUMMARIES[item.to]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Signal({
  label,
  value,
  hint,
  pending,
  failed,
  tone,
}: {
  label: string;
  value?: string;
  hint?: string;
  pending: boolean;
  failed: boolean;
  tone: "ok" | "warn" | "danger" | "muted";
}) {
  return (
    <div className="border-line-soft bg-surface-1 px-4 py-3 sm:border-r sm:last:border-r-0 max-sm:border-b max-sm:last:border-b-0">
      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1.5">
        {pending && !failed ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <p
            className={cn(
              "text-sm font-medium",
              tone === "ok" && "text-foreground",
              tone === "warn" && "text-warning",
              tone === "danger" && "text-destructive",
              tone === "muted" && "text-muted-foreground",
            )}
          >
            {value ?? "—"}
          </p>
        )}
        {hint && !pending && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </dd>
    </div>
  );
}
