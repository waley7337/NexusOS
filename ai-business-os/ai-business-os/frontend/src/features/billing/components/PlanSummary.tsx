import type { BillingPlanPrice, PlatformPlan } from "@/features/settings/services/billingService";
import {
  formatBillingInterval,
  formatMoneyFromStripeMinor,
  planLabel,
} from "@/features/billing/formatPlanPrice";

interface PlanSummaryProps {
  plan: Exclude<PlatformPlan, "free">;
  price: BillingPlanPrice | undefined;
}

export function PlanSummary({ plan, price }: PlanSummaryProps) {
  const amount = formatMoneyFromStripeMinor(price?.unitAmount, price?.currency);
  const interval = formatBillingInterval(price?.interval, price?.intervalCount);
  const currency = price?.currency?.toUpperCase() ?? "—";

  return (
    <aside
      className="space-y-4 rounded-[var(--r-surface)] border border-line-soft bg-surface-3/80 p-4"
      aria-label="Order summary"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected plan
        </p>
        <h2 className="mt-1 text-h3 text-foreground">{planLabel(plan)}</h2>
        {price?.productName && (
          <p className="mt-0.5 text-sm text-muted-foreground">{price.productName}</p>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Billing interval</dt>
          <dd className="capitalize font-medium text-foreground">{interval}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Currency</dt>
          <dd className="font-mono text-foreground">{currency}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-3">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="font-medium text-foreground">{amount}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="text-muted-foreground">Calculated by Stripe at confirm</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-3">
          <dt className="font-semibold text-foreground">Total due today</dt>
          <dd className="text-lg font-semibold text-foreground">{amount}</dd>
        </div>
      </dl>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Amounts come from server-side Stripe Price IDs. Access updates only after
        NexusOS confirms the subscription — completing payment here is not itself
        entitlement.
      </p>
    </aside>
  );
}
