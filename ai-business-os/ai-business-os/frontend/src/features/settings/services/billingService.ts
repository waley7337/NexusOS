import { request } from "@/api/client";

export type PlatformPlan = "free" | "starter" | "pro" | "enterprise";
export type PlatformSubscriptionStatus =
  | "no_subscription"
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "canceled"
  | "paused";

export interface BillingStatus {
  plan: PlatformPlan;
  status: PlatformSubscriptionStatus;
  entitled: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  stripeCustomerLinked: boolean;
  billingEnabled: boolean;
}

export interface BillingCheckoutSession {
  checkoutUrl: string | null;
  checkoutSessionId: string | null;
  plan: PlatformPlan;
  /** "checkout" opens Stripe Checkout; "subscription_updated" changed the existing sub in place. */
  mode: "checkout" | "subscription_updated";
}

export interface BillingPortalSession {
  portalUrl: string;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getBillingStatus(signal?: AbortSignal): Promise<BillingStatus> {
  return request({ method: "GET", url: "/billing/subscription", signal });
}

export function createBillingCheckout(
  plan: Exclude<PlatformPlan, "free">,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<BillingCheckoutSession> {
  return request({
    method: "POST",
    url: "/billing/checkout",
    data: { plan },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function createBillingPortal(): Promise<BillingPortalSession> {
  return request({ method: "POST", url: "/billing/portal" });
}

export function cancelBillingSubscription(): Promise<BillingStatus> {
  return request({ method: "POST", url: "/billing/cancel" });
}
