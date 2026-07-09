/**
 * Dashboard — "How is my business doing?"
 * Layout follows the Part 2 spec: greeting → KPIs → charts/activity →
 * meetings + AI insights. Data flows through one query; each widget
 * renders its own skeleton until it arrives.
 */
import { useAuthStore } from "@/stores/auth";
import { useDashboard } from "@/features/dashboard/api";
import {
  ActivityFeed, AiInsights, KpiGrid, PipelineChart, RevenueChart, UpcomingMeetings,
} from "@/features/dashboard/widgets";
import { ErrorState } from "@/components/ui/error-state";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isError, refetch } = useDashboard();

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {user?.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Here's what's happening today.</p>
      </div>

      <KpiGrid kpis={data?.kpis} />

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueChart data={data?.revenue} />
        <PipelineChart data={data?.pipeline} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityFeed items={data?.activity} />
        <UpcomingMeetings meetings={data?.meetings} />
        <AiInsights insights={data?.insights} />
      </div>
    </div>
  );
}
