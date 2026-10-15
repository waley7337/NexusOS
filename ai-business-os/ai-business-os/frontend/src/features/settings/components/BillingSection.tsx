import { useEffect, useRef } from "react";
import { AxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/constants/queryKeys";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/usePermission";
import * as billing from "../services/billingService";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

/** Classify load failures — disabled billing is a 200 success path, not an error. */
function billingLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 404) {
      return "Billing API route not found (HTTP 404). The running API may be behind the finance release that serves GET /api/v1/billing/subscription — redeploy that API, then retry.";
    }
    if (error.errors.some((item) => item.code === "billing_profile_invariant")) {
      return "Company billing profile is not provisioned. Apply platform billing migrations on this database, then retry.";
    }
    return error.message;
  }
  if (error instanceof AxiosError && !error.response) {
    return "Cannot reach the API. Confirm the backend is running and the frontend API base URL is correct.";
  }
  return errorMessage(error);
}

const PLAN_OPTIONS: Array<Exclude<billing.PlatformPlan, "free">> = [
  "starter",
  "pro",
  "enterprise",
];

/** Exact server env var names required before live SaaS checkout can enable. */
export const BILLING_ENV_VAR_NAMES = [
  "STRIPE_BILLING_ENABLED",
  "STRIPE_PLATFORM_SECRET_KEY",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_ENTERPRISE",
  "STRIPE_PLATFORM_WEBHOOK_SECRET",
  "FRONTEND_URL",
] as const;

const RETURN_MESSAGES: Record<string, string> = {
  success:
    "Checkout returned to NexusOS. Plan access updates only after the server confirms the subscription — this redirect is not confirmation.",
  cancel: "Checkout was canceled. No plan change was applied.",
  portal: "Returned from the billing portal. Status below refreshes from the server.",
};

export function BillingSection() {
  const canView = usePermission("settings.view");
  const canManage = usePermission("settings.manage");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledReturn = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.billing.subscription,
    queryFn: ({ signal }) => billing.getBillingStatus(signal),
    enabled: canView,
  });

  const portal = useMutation({ mutationFn: () => billing.createBillingPortal() });
  const cancel = useMutation({
    mutationFn: () => billing.cancelBillingSubscription(),
    onSuccess: (status) => {
      client.setQueryData(queryKeys.billing.subscription, status);
      toast.success("Subscription will cancel at period end.");
    },
  });

  useEffect(() => {
    if (!canView) return;
    const outcome = searchParams.get("billing");
    if (!outcome || !(outcome in RETURN_MESSAGES)) return;
    if (handledReturn.current === outcome) return;
    handledReturn.current = outcome;
    toast.message(RETURN_MESSAGES[outcome]);
    // Redirect never grants access — re-read authoritative server status.
    void client.invalidateQueries({ queryKey: queryKeys.billing.subscription });
    const next = new URLSearchParams(searchParams);
    next.delete("billing");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
  }, [canView, client, searchParams, setSearchParams]);

  if (!canView) return null;

  if (query.isPending) {
    return (
      <section id="billing" aria-label="Loading billing" className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-28" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <section id="billing" className="space-y-3">
        <ErrorState
          title="Billing unavailable"
          description={billingLoadErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
        <p className="text-xs text-muted-foreground">
          This is a request failure — not the same as billing being disabled.
          Disabled SaaS checkout returns HTTP 200 with{" "}
          <code className="font-mono">billingEnabled: false</code> and actionable env guidance.
          SaaS billing uses <code className="font-mono">GET /api/v1/billing/subscription</code>.
        </p>
      </section>
    );
  }

  const status = query.data;

  return (
    <section id="billing" className="space-y-3 rounded-card border border-line-soft bg-surface-2 p-5">
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
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Live SaaS checkout stays disabled until Stripe billing credentials and price IDs
            are configured on the server. Keep{" "}
            <code className="font-mono">STRIPE_BILLING_ENABLED=false</code> until ready.
          </p>
          <p>
            Required env var names:{" "}
            <code className="font-mono">{BILLING_ENV_VAR_NAMES.join(", ")}</code>
          </p>
        </div>
      )}
      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          {PLAN_OPTIONS.map((plan) => (
            <Button
              key={plan}
              size="sm"
              variant="outline"
              disabled={!status.billingEnabled}
              onClick={() => {
                // Custom Elements checkout (same spatial shell as login).
                // Duplicate-sub / past_due / in-place upgrade rules stay on the server.
                navigate(`${ROUTES.billingCheckout}?plan=${plan}`);
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
