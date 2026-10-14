import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/constants/queryKeys";
import { usePermission } from "@/hooks/usePermission";
import * as providers from "../services/paymentProvidersService";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

export function StripeConnectSection() {
  const canRead = usePermission("payment_providers.read");
  const canManage = usePermission("payment_providers.manage");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.finance.paymentProviders.stripe,
    queryFn: ({ signal }) => providers.getStripeConnectStatus(signal),
    enabled: canRead,
  });

  const onboard = useMutation({
    mutationFn: () => providers.startStripeConnectOnboarding(),
  });
  const sync = useMutation({
    mutationFn: () => providers.syncStripeConnectAccount(),
    onSuccess: (status) => {
      client.setQueryData(queryKeys.finance.paymentProviders.stripe, status);
      toast.success("Stripe Connect status refreshed.");
    },
  });

  if (!canRead) return null;

  if (query.isPending) {
    return (
      <section aria-label="Loading Stripe Connect" className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-24" />
      </section>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Stripe Connect unavailable"
        description={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const status = query.data;

  return (
    <section className="space-y-3 rounded-card border border-line-soft bg-surface-2 p-5">
      <div>
        <h2 className="text-sm font-semibold">Customer invoice payments (Stripe Connect)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoice card payments settle on your connected Stripe account. NexusOS does not
          route those proceeds into the platform balance by default.
        </p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Connection</dt>
          <dd className="capitalize font-medium">
            {status.connectionStatus?.replaceAll("_", " ") ?? "Not connected"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Charges enabled</dt>
          <dd className="font-medium">{status.chargesEnabled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tenant payments configured</dt>
          <dd className="font-medium">{status.paymentsEnabled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Account</dt>
          <dd className="font-mono text-xs">{status.externalAccountId ?? "—"}</dd>
        </div>
      </dl>
      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          <Button
            size="sm"
            loading={onboard.isPending}
            disabled={!status.paymentsEnabled}
            onClick={() => {
              void (async () => {
                try {
                  const link = await onboard.mutateAsync();
                  window.location.assign(link.onboardingUrl);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              })();
            }}
          >
            {status.accountId ? "Continue onboarding" : "Connect Stripe"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={sync.isPending}
            disabled={!status.accountId || !status.paymentsEnabled}
            onClick={() => {
              void sync.mutateAsync().catch((error) => toast.error(errorMessage(error)));
            }}
          >
            Sync status
          </Button>
        </div>
      )}
    </section>
  );
}
