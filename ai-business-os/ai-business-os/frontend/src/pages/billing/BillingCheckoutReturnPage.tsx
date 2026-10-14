/**
 * Elements checkout return page. Session status is informational only —
 * entitlements refresh from GET /billing/subscription, never from this redirect.
 */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { queryKeys } from "@/constants/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import { planLabel } from "@/features/billing/formatPlanPrice";
import * as billing from "@/features/settings/services/billingService";
import { cn } from "@/lib/utils";

export function BillingCheckoutReturnPage() {
  const canManage = usePermission("settings.manage");
  const client = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const sessionQuery = useQuery({
    queryKey: queryKeys.billing.checkoutSession(sessionId ?? ""),
    queryFn: ({ signal }) => billing.getBillingCheckoutSessionStatus(sessionId!, signal),
    enabled: canManage && Boolean(sessionId),
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: ({ signal }) => billing.getBillingStatus(signal),
    enabled: canManage,
  });

  useEffect(() => {
    void client.invalidateQueries({ queryKey: queryKeys.billing.subscription });
  }, [client]);

  if (!canManage) {
    return (
      <ErrorState
        title="Checkout return unavailable"
        description="You need settings manage access to view this page."
      />
    );
  }

  if (!sessionId) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Missing checkout session"
          description="Stripe did not return a session id. No plan change was applied from this page."
        />
        <Link to={ROUTES.settings} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to settings
        </Link>
      </div>
    );
  }

  if (sessionQuery.isPending || statusQuery.isPending) {
    return (
      <div className="space-y-3" aria-label="Loading checkout result" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not verify checkout"
          description="The redirect is not confirmation. Open Settings to refresh authoritative billing status."
          onRetry={() => void sessionQuery.refetch()}
        />
        <Link to={ROUTES.settings} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to settings
        </Link>
      </div>
    );
  }

  const session = sessionQuery.data;
  const complete = session.status === "complete";
  const entitled = statusQuery.data?.entitled ?? false;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">
          {complete ? "Payment submitted" : "Checkout incomplete"}
        </h1>
        <p className="text-body text-muted-foreground">
          {complete
            ? "Stripe accepted the payment attempt. NexusOS entitlements update only after the server confirms the subscription."
            : "Checkout did not complete. No paid access was granted from this redirect."}
        </p>
      </div>

      <dl className="grid gap-2 rounded-[var(--r-surface)] border border-line-soft bg-surface-3/80 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Checkout status</dt>
          <dd className="capitalize font-medium">{session.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment status</dt>
          <dd className="capitalize font-medium">
            {session.paymentStatus.replaceAll("_", " ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="font-medium">
            {session.plan ? planLabel(session.plan) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Server entitled</dt>
          <dd className="font-medium">{entitled ? "Yes" : "Not yet"}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to={ROUTES.settings}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-11 flex-1")}
        >
          Open billing settings
        </Link>
        {!complete && (
          <Link
            to={`${ROUTES.billingCheckout}?plan=${session.plan ?? "starter"}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 flex-1")}
          >
            Try again
          </Link>
        )}
      </div>
    </div>
  );
}
