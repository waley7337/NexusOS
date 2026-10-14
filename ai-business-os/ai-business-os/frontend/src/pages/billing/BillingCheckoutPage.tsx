/**
 * Custom NexusOS subscription checkout — SpatialShell + Stripe Elements.
 * Entitlements stay server/webhook authoritative; this UI never grants access.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CheckoutElementsProvider } from "@stripe/react-stripe-js/checkout";
import { ApiRequestError } from "@/api/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { queryKeys } from "@/constants/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import { CheckoutPaymentForm } from "@/features/billing/components/CheckoutPaymentForm";
import { PlanSummary } from "@/features/billing/components/PlanSummary";
import {
  findPlanPrice,
  isBillablePlan,
  planLabel,
} from "@/features/billing/formatPlanPrice";
import { nexusStripeAppearance } from "@/features/billing/stripeAppearance";
import * as billing from "@/features/settings/services/billingService";
import { BILLING_ENV_VAR_NAMES } from "@/features/settings/components/BillingSection";
import { cn } from "@/lib/utils";

const stripePromises = new Map<string, Promise<Stripe | null>>();

function stripePromiseFor(publishableKey: string): Promise<Stripe | null> {
  let promise = stripePromises.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, promise);
  }
  return promise;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : "Could not start checkout.";
}

const PORTAL_RECOVERY_REASONS = new Set([
  "subscription_past_due",
  "subscription_incomplete",
  "subscription_paused",
  "subscription_upgrade_payment_required",
  "subscription_upgrade_not_entitled",
]);

export function BillingCheckoutPage() {
  const canManage = usePermission("settings.manage");
  const canView = usePermission("settings.view");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");
  const plan = isBillablePlan(planParam) ? planParam : null;

  const [sessionBoot, setSessionBoot] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [bootError, setBootError] = useState<{
    message: string;
    reason?: string;
  } | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: ({ signal }) => billing.getBillingStatus(signal),
    enabled: canView,
  });

  const plansQuery = useQuery({
    queryKey: queryKeys.billing.plans,
    queryFn: ({ signal }) => billing.getBillingPlans(signal),
    enabled: canView,
  });

  const portal = useMutation({
    mutationFn: () => billing.createBillingPortal(),
  });

  const startCheckout = useMutation({
    mutationFn: (selected: Exclude<billing.PlatformPlan, "free">) =>
      billing.createBillingCheckout(selected, { uiMode: "elements" }),
    onSuccess: (session) => {
      setBootError(null);
      if (session.mode === "subscription_updated") {
        navigate(`${ROUTES.settings}?billing=success`, { replace: true });
        return;
      }
      if (!session.clientSecret || !session.publishableKey) {
        setBootError({
          message:
            "Checkout session was created without a client secret or publishable key. Confirm Stripe Elements credentials on the server.",
        });
        return;
      }
      setSessionBoot({
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
      });
    },
    onError: (error) => {
      setBootError({
        message: errorMessage(error),
        reason: billing.billingErrorReason(error),
      });
    },
  });

  const price = plan ? findPlanPrice(plansQuery.data?.plans, plan) : undefined;
  const appearance = useMemo(() => nexusStripeAppearance(), [sessionBoot?.clientSecret]);

  if (!canView) {
    return (
      <ErrorState
        title="Billing unavailable"
        description="You need settings access to open checkout."
      />
    );
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Choose a plan"
          description="Open checkout from Settings with a valid plan (starter, pro, or enterprise)."
        />
        <Link to={ROUTES.settings} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to settings
        </Link>
      </div>
    );
  }

  if (statusQuery.isPending || plansQuery.isPending) {
    return (
      <div className="space-y-4" aria-label="Loading checkout" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <ErrorState
        title="Billing unavailable"
        description={errorMessage(statusQuery.error)}
        onRetry={() => void statusQuery.refetch()}
      />
    );
  }

  const status = statusQuery.data;
  const needsPortal =
    status.status === "past_due" ||
    status.status === "incomplete" ||
    (bootError?.reason != null && PORTAL_RECOVERY_REASONS.has(bootError.reason));

  if (!status.billingEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-h2 text-foreground">Subscribe to NexusOS</h1>
        <p className="text-sm text-muted-foreground">
          Live SaaS checkout stays disabled until Stripe billing credentials and price
          IDs are configured on the server. Keep{" "}
          <code className="font-mono">STRIPE_BILLING_ENABLED=false</code> until ready.
        </p>
        <p className="text-xs text-muted-foreground">
          Required env var names:{" "}
          <code className="font-mono">{BILLING_ENV_VAR_NAMES.join(", ")}</code>
        </p>
        <Link to={ROUTES.settings} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to settings
        </Link>
      </div>
    );
  }

  if (needsPortal && !sessionBoot) {
    return (
      <div className="space-y-4">
        <h1 className="text-h2 text-foreground">Update payment method</h1>
        <p className="text-sm text-muted-foreground">
          {bootError?.message ||
            "Your subscription needs attention in the Stripe billing portal before a new checkout or plan change can start. A second subscription will not be created."}
        </p>
        {canManage && (
          <Button
            variant="primary"
            size="lg"
            className="h-11 w-full"
            loading={portal.isPending}
            onClick={() => {
              void (async () => {
                try {
                  const session = await portal.mutateAsync();
                  window.location.assign(session.portalUrl);
                } catch (error) {
                  setBootError({ message: errorMessage(error) });
                }
              })();
            }}
          >
            Open billing portal
          </Button>
        )}
        <Link to={ROUTES.settings} className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
          Back to settings
        </Link>
      </div>
    );
  }

  if (!canManage) {
    return (
      <ErrorState
        title="Checkout requires manage access"
        description="Ask a workspace owner or admin to complete subscription checkout."
      />
    );
  }

  if (!sessionBoot) {
    return (
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-h2 text-foreground">Subscribe to NexusOS</h1>
            <p className="text-body text-muted-foreground">
              Confirm {planLabel(plan)} and pay securely. Plan access updates only after
              the server confirms the subscription.
            </p>
          </div>
          <PlanSummary plan={plan} price={price} />
          {bootError && (
            <p className="text-sm text-destructive" role="alert">
              {bootError.message}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              className="h-11 flex-1"
              loading={startCheckout.isPending}
              disabled={!price?.configured}
              onClick={() => startCheckout.mutate(plan)}
            >
              Continue to payment
            </Button>
            <Link
              to={ROUTES.settings}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 flex-1")}
            >
              Cancel
            </Link>
          </div>
          {!price?.configured && (
            <p className="text-xs text-muted-foreground">
              Server price for this plan is not configured yet.
            </p>
          )}
        </div>
        <div className="hidden rounded-[var(--r-surface)] border border-dashed border-line-soft p-6 text-sm text-muted-foreground md:block">
          <p className="font-medium text-foreground">What happens next</p>
          <ol className="mt-3 list-decimal space-y-2 pl-4">
            <li>Stripe Payment Element collects your payment method.</li>
            <li>NexusOS waits for webhook confirmation before granting access.</li>
            <li>Failed or incomplete payments never unlock paid features early.</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h1 className="text-h2 text-foreground">Confirm subscription</h1>
          <p className="text-body text-muted-foreground">
            {planLabel(plan)} · amounts from Stripe Price IDs on the server.
          </p>
        </div>
        <PlanSummary plan={plan} price={price} />
        <Link
          to={ROUTES.settings}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          Back to settings
        </Link>
      </div>

      <CheckoutElementsProvider
        stripe={stripePromiseFor(sessionBoot.publishableKey)}
        options={{
          clientSecret: sessionBoot.clientSecret,
          elementsOptions: { appearance },
        }}
      >
        <CheckoutPaymentForm submitLabel={`Subscribe to ${planLabel(plan)}`} />
      </CheckoutElementsProvider>
    </div>
  );
}
