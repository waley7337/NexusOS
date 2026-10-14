import type { BillingPlanPrice, PlatformPlan } from "@/features/settings/services/billingService";

export const BILLABLE_PLANS: Array<Exclude<PlatformPlan, "free">> = [
  "starter",
  "pro",
  "enterprise",
];

export function isBillablePlan(value: string | null | undefined): value is Exclude<PlatformPlan, "free"> {
  return value === "starter" || value === "pro" || value === "enterprise";
}

export function formatMoneyFromStripeMinor(
  unitAmount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (unitAmount == null || !currency) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(unitAmount / 100);
  } catch {
    return `${(unitAmount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function formatBillingInterval(
  interval: string | null | undefined,
  intervalCount: number | null | undefined,
): string {
  if (!interval) return "recurring";
  const count = intervalCount && intervalCount > 1 ? intervalCount : 1;
  if (count === 1) {
    if (interval === "month") return "monthly";
    if (interval === "year") return "yearly";
    return `per ${interval}`;
  }
  return `every ${count} ${interval}s`;
}

export function planLabel(plan: PlatformPlan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function findPlanPrice(
  plans: BillingPlanPrice[] | undefined,
  plan: Exclude<PlatformPlan, "free">,
): BillingPlanPrice | undefined {
  return plans?.find((item) => item.plan === plan);
}
