/**
 * Mission Control — the operational canvas (recomposed, V5).
 *
 * TRUTHFULNESS IS UNCHANGED AND NON-NEGOTIABLE.
 * Every value on this page still comes from a real source: auth identity,
 * useLiveClock, and GET /health + GET /ready via useDashboard. No KPI, no
 * revenue, no pipeline, no activity feed, no AI insight, no invented count.
 * V5 changed the COMPOSITION, not the data.
 *
 * WHAT WAS WRONG
 * The page read as "heading / status rectangle / two columns / large empty
 * rectangle / list" — four bounded boxes stacked in a column, which is the
 * card-as-default-structure habit the reconstruction exists to remove. The
 * honest content was already right; it was wearing the wrong architecture.
 *
 * THE COMPOSITION
 * Three bands on one continuous canvas, separated by rules and register
 * rather than by containers:
 *
 *   1 SYSTEM     what the machine reports about itself, right now
 *   2 WORKSPACE  the honest operational state — nothing is here yet
 *   3 MODULES    the real routes, each with its true condition
 *
 * Every band is introduced by a rail-aligned machine label. Nothing on this
 * page is a Plane: a Plane is a surface that is genuinely a separate layer
 * from the page, and Mission Control is one canvas, so wrapping any band in
 * one would re-introduce exactly the boxes V5 removed.
 */
import { Link } from "react-router-dom";
import { LayoutDashboard, Plus } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useDashboard } from "@/features/dashboard";
import { MODULE_SUMMARIES } from "@/features/dashboard/constants";
import { NAV_ITEMS, ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowGroup } from "@/components/ui/structure";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function greetingAt(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const MODULES = NAV_ITEMS.filter((item) => item.to !== ROUTES.home);

/**
 * Band heading. A machine label on a rail, not a title in a box — the label
 * names the band and the rule carries it across the canvas, which is how a
 * band gets identity without a container.
 */
function BandLabel({ children, id }: { children: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 id={id} className="text-machine shrink-0">
        {children}
      </h2>
      <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
    </div>
  );
}

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
    <div className="space-y-10">
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

      {/* ============ BAND 1 · SYSTEM ============
          Hairline-separated readouts, no container. Each is a real probe
          result; the value wears the machine register because a machine
          produced it. */}
      <section aria-labelledby="band-system" className="space-y-4">
        <BandLabel id="band-system">System</BandLabel>

        <dl className="grid gap-px bg-line-soft sm:grid-cols-3">
          <Readout
            label="API"
            pending={isPending && !isError}
            value={apiOk ? "Reachable" : isError ? "Unreachable" : "Unknown"}
            hint={data?.environment}
            tone={isError || (!isPending && !apiOk) ? "bad" : apiOk ? "ok" : "muted"}
          />
          <Readout
            label="Database"
            pending={isPending && !isError}
            value={dbOk ? "Ready" : "Unavailable"}
            tone={dbOk ? "ok" : isError ? "muted" : "warn"}
          />
          <Readout
            label="Workspace"
            pending={false}
            value={user?.companyName ?? "—"}
            hint={user?.email}
            tone="ok"
          />
        </dl>

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
      </section>

      {/* ============ BAND 2 · WORKSPACE ============
          The honest operational state. This is the product's most important
          sentence right now, so it gets the canvas to itself rather than
          being one of two columns. */}
      <section aria-labelledby="band-workspace" className="space-y-4">
        <BandLabel id="band-workspace">Workspace</BandLabel>

        <EmptyState
          icon={LayoutDashboard}
          as="h3"
          status="No metrics source"
          title="No operational metrics yet"
          description="Revenue, pipeline, tasks, and activity will appear here when those modules have APIs. Nothing below is estimated."
        >
          {/* V8: -my-1.5 py-1.5 lifts these from a 16px hit target to 28px
                without moving a pixel of layout. WCAG 2.2 SC 2.5.8 wants
                24x24 for standalone controls; these are not inline in a
                sentence, so the text-link exception does not apply. */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              className="focus-ring text-machine -my-1.5 rounded py-1.5 transition-colors duration-fast hover:text-foreground"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="focus-ring text-machine -my-1.5 rounded py-1.5 transition-colors duration-fast hover:text-foreground"
            >
              Search
            </button>
            <Link
              to={ROUTES.design}
              className="focus-ring text-machine -my-1.5 rounded py-1.5 transition-colors duration-fast hover:text-foreground"
            >
              Design system
            </Link>
          </div>
        </EmptyState>
      </section>

      {/* ============ BAND 3 · MODULES ============
          The real routes as a ledger: hairline rows, no box, the condition
          in the trailing register. An empty ledger with correct structure
          reads as a system awaiting data — which is exactly what this is. */}
      <section aria-labelledby="band-modules" className="space-y-2">
        <BandLabel id="band-modules">Modules</BandLabel>

        <RowGroup>
          {MODULES.map((item) => {
            const Icon = item.icon;
            return (
              <Row
                key={item.to}
                as={Link}
                to={item.to}
                interactive
                className="items-center rounded-control px-2"
                marker={<Icon className="h-4 w-4" aria-hidden="true" />}
                register="Not operational"
              >
                <span className="block text-sm font-medium text-foreground">{item.label}</span>
                <span className="mt-0.5 block truncate text-small text-muted-foreground">
                  {MODULE_SUMMARIES[item.to]}
                </span>
              </Row>
            );
          })}
        </RowGroup>
      </section>
    </div>
  );
}

/** One system readout. Label in machine register, value in product voice. */
function Readout({
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
    <div className="bg-background px-4 py-3 first:pl-0">
      <dt className="text-machine">{label}</dt>
      <dd className="mt-1.5">
        {pending ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <p
            className={cn(
              "text-sm font-medium",
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
          <p className="mt-0.5 truncate text-small text-muted-foreground">{hint}</p>
        )}
      </dd>
    </div>
  );
}
