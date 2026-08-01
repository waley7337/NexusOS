/**
 * Dashboard — "How is my business doing?"
 * Hero (Part 04, Phase 7): live status + clock, greeting, directive,
 * quarter progress, RadialGauge — the visual language the whole Core
 * Platform effort has been building toward, applied with NexusOS's own
 * business content (not LifeOS's personal-life modules). Everything below
 * the hero (charts, activity, insights) is untouched from Parts 1-3: one
 * query, each widget owns its own skeleton.
 */
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useSpotlight } from "@/hooks/useSpotlight";
import { useRevealVariants } from "@/hooks/useRevealVariants";
import {
  useDashboard,
  ActivityFeed,
  AiInsights,
  KpiGrid,
  PipelineChart,
  RevenueChart,
  UpcomingMeetings,
} from "@/features/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isError, refetch } = useDashboard();
  const systemStatus = useSystemStatus();
  const clock = useLiveClock();
  const setCaptureOpen = useUiStore((s) => s.setCaptureOpen);
  const heroRef = useSpotlight<HTMLDivElement>();
  const reveal = useRevealVariants();

  if (isError) {
    return (
      <ErrorState
        title="We couldn't load your dashboard"
        description="Something went wrong on our side. Your data is safe — please try again."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <motion.div variants={reveal.container} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={reveal.item}>
        <Card ref={heroRef} className="spotlight relative overflow-hidden">
          <div className="glow-banner pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="grid-field pointer-events-none absolute inset-0" aria-hidden="true" />
          {/* Two very slowly drifting blurred orbs — 14s, ~3% travel. Ambient
              motion at this amplitude is felt rather than seen; it stops the
              hero reading as a static image without ever competing with the
              content. Switched off entirely under prefers-reduced-motion. */}
          <div
            className="drift pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-primary/20 blur-[90px]"
            aria-hidden="true"
          />
          <div
            className="drift pointer-events-none absolute -bottom-40 right-10 h-72 w-72 rounded-full bg-chart-1/15 blur-[90px]"
            style={{ animationDelay: "-6s" }}
            aria-hidden="true"
          />
          {/* items-center, not items-start (Part 04 convergence, Commit B):
              the right column runs ~280px and the left ran ~159px, so
              top-aligning them left a measured 142px of dead space — 44% of
              the hero's height. Centring plus moving the CTAs below the
              directive balances the two columns instead. */}
          <CardContent className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.45fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusPill variant={systemStatus.variant} label={systemStatus.label} />
                <span className="num font-mono text-2xs text-muted-foreground">
                  {clock.toLocaleTimeString([], { hour12: false })}
                </span>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">
                {clock.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>

              <PageHeader
                className="mt-1"
                title={`${greeting()}, ${user?.name?.split(" ")[0] ?? "there"} 👋`}
                description={
                  data && (
                    <>
                      This week's focus — <span className="font-medium text-primary">{data.directive}</span>.
                    </>
                  )
                }
              />
              {!data && <Skeleton className="mt-3 h-5 w-72" />}

              <div className="mt-6 max-w-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Quarter progress</span>
                  {data && (
                    <span className="num text-2xs text-muted-foreground">
                      {data.quarterProgress.weekLabel} · {data.quarterProgress.percent}%
                    </span>
                  )}
                </div>
                {data ? <Progress value={data.quarterProgress.percent} /> : <Skeleton className="h-2 w-full" />}
              </div>

              <div className="mt-7 flex flex-wrap gap-2.5">
                <Button variant="outline" onClick={() => toast.info("Weekly review ships in a later part.")}>
                  Begin weekly review
                </Button>
                <Button onClick={() => setCaptureOpen(true)}>
                  <Plus /> Capture
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-5">
              {data ? (
                <RadialGauge score={data.health.score} scoreLabel="Health" segments={data.health.segments} />
              ) : (
                <Skeleton className="h-[220px] w-[220px] rounded-full" />
              )}
              <div className="grid w-full max-w-xs grid-cols-3 gap-2">
                {(
                  [
                    ["runway", "Runway"],
                    ["capacity", "Capacity"],
                    ["quarterPlan", "Q3 plan"],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="rounded-xl border px-3 py-2.5 text-center"
                    style={{ borderColor: "var(--line-soft)", backgroundColor: "hsl(var(--surface-1) / 0.6)" }}
                  >
                    {data ? (
                      <p className="num font-mono text-lg font-semibold">{data.metrics[key]}</p>
                    ) : (
                      <Skeleton className="mx-auto h-6 w-10" />
                    )}
                    <p className="mt-0.5 text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={reveal.item}>
        <KpiGrid kpis={data?.kpis} />
      </motion.div>

      <motion.div variants={reveal.item} className="grid gap-4 lg:grid-cols-3">
        <RevenueChart data={data?.revenue} />
        <PipelineChart data={data?.pipeline} />
      </motion.div>

      <motion.div variants={reveal.item} className="grid gap-4 lg:grid-cols-3">
        <ActivityFeed items={data?.activity} />
        <UpcomingMeetings meetings={data?.meetings} />
        <AiInsights insights={data?.insights} />
      </motion.div>
    </motion.div>
  );
}
