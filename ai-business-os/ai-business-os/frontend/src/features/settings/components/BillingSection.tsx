import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/constants/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import * as billing from "../services/billingService";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

const PLAN_OPTIONS: Array<Exclude<billing.PlatformPlan, "free">> = [
  "starter",
  "pro",
  "enterprise",
];

export function BillingSection() {
  const canView = usePermission("settings.view");
  const canManage = usePermission("settings.manage");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: ({ signal }) => billing.getBillingStatus(signal),
    enabled: canView,
  });

  const checkout = useMutation({
    mutationFn: (plan: Exclude<billing.PlatformPlan, "free">) =>
      billing.createBillingCheckout(plan),
  });
  const portal = useMutation({ mutationFn: () => billing.createBillingPortal() });
  const cancel = useMutation({
    mutationFn: () => billing.cancelBillingSubscription(),
    onSuccess: (status) => {
      client.setQueryData(queryKeys.billing.subscription, status);
      toast.success("Subscription will cancel at period end.");
    },
  });

  if (!canView) return null;

  if (query.isPending) {
    return (
      <section aria-label="Loading billing" className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-28" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Billing unavailable"
        description={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const status = query.data;

  return (
    <section className="space-y-3 rounded-card border border-line-soft bg-surface-2 p-5">
      <div>
        <h2 className="text-sm font-semibold">NexusOS subscription</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform billing is separate from customer invoice payments. Plan and status come
          from the server — never trust the browser as confirmation.
        </p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="capitalize font-medium">{status.plan}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="capitalize font-medium">{status.status.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Entitled</dt>
          <dd className="font-medium">{status.entitled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Billing configured</dt>
          <dd className="font-medium">{status.billingEnabled ? "Yes" : "No"}</dd>
        </div>
      </dl>
      {!status.billingEnabled && (
        <p className="text-xs text-muted-foreground">
          Live SaaS checkout stays disabled until Stripe billing credentials and price IDs
          are configured on the server.
        </p>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          {PLAN_OPTIONS.map((plan) => (
            <Button
              key={plan}
              size="sm"
              variant="outline"
              loading={checkout.isPending}
              disabled={!status.billingEnabled}
              onClick={() => {
                void (async () => {
                  try {
                    const session = await checkout.mutateAsync(plan);
                    window.location.assign(session.checkoutUrl);
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                })();
              }}
            >
              Upgrade {plan}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            loading={portal.isPending}
            disabled={!status.billingEnabled || !status.stripeCustomerLinked}
            onClick={() => {
              void (async () => {
                try {
                  const session = await portal.mutateAsync();
                  window.location.assign(session.portalUrl);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              })();
            }}
          >
            Open portal
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={cancel.isPending}
            disabled={!status.billingEnabled || status.cancelAtPeriodEnd}
            onClick={() => {
              void cancel.mutateAsync().catch((error) => toast.error(errorMessage(error)));
            }}
          >
            Cancel at period end
          </Button>
        </div>
      )}
    </section>
  );
}
