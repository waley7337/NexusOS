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
import { fadeInUp, staggerSection } from "@/lib/motion";
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
    <motion.div variants={staggerSection} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden">
          <div className="glow-banner pointer-events-none absolute inset-0" aria-hidden="true" />
          <CardContent className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <StatusPill variant={systemStatus.variant} label={systemStatus.label} />
                <span className="font-mono text-xs text-muted-foreground">
                  {clock.toLocaleTimeString([], { hour12: false })}
                </span>
              </div>

              <PageHeader
                title={`${greeting()}, ${user?.name?.split(" ")[0] ?? "there"} 👋`}
                description={
                  data && (
                    <>
                      This week's focus — <span className="font-medium text-primary">{data.directive}</span>.
                    </>
                  )
                }
                actions={
                  <>
                    <Button variant="outline" onClick={() => toast.info("Weekly review ships in a later part.")}>
                      Begin weekly review
                    </Button>
                    <Button onClick={() => setCaptureOpen(true)}>
                      <Plus /> Capture
                    </Button>
                  </>
                }
              />
              {!data && <Skeleton className="h-5 w-72" />}

              <div className="max-w-md space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-caption">Quarter progress</p>
                  {data && (
                    <p className="text-xs text-muted-foreground">
                      {data.quarterProgress.weekLabel} · {data.quarterProgress.percent}%
                    </p>
                  )}
                </div>
                {data ? <Progress value={data.quarterProgress.percent} /> : <Skeleton className="h-2 w-full" />}
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              {data ? (
                <RadialGauge score={data.health.score} scoreLabel="Health" segments={data.health.segments} />
              ) : (
                <Skeleton className="h-[220px] w-[220px] rounded-full" />
              )}
              <div className="grid grid-cols-3 gap-4 text-center">
                {(["runway", "capacity", "quarterPlan"] as const).map((key) => (
                  <div key={key}>
                    {data ? (
                      <p className="font-mono text-lg font-semibold">{data.metrics[key]}</p>
                    ) : (
                      <Skeleton className="mx-auto h-6 w-12" />
                    )}
                    <p className="text-caption">
                      {key === "runway" ? "Runway" : key === "capacity" ? "Capacity" : "Q3 plan"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <KpiGrid kpis={data?.kpis} />
      </motion.div>

      <motion.div variants={fadeInUp} className="grid gap-4 lg:grid-cols-3">
        <RevenueChart data={data?.revenue} />
        <PipelineChart data={data?.pipeline} />
      </motion.div>

      <motion.div variants={fadeInUp} className="grid gap-4 lg:grid-cols-3">
        <ActivityFeed items={data?.activity} />
        <UpcomingMeetings meetings={data?.meetings} />
        <AiInsights insights={data?.insights} />
      </motion.div>
    </motion.div>
  );
}
