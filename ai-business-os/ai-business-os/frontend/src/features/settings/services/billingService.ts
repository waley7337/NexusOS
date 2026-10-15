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

export type CheckoutUiMode = "hosted" | "elements";

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
  clientSecret: string | null;
  publishableKey: string | null;
  plan: PlatformPlan;
  /** "checkout" opens Stripe Checkout; "subscription_updated" changed the existing sub in place. */
  mode: "checkout" | "subscription_updated";
  uiMode: CheckoutUiMode;
}

export interface BillingPortalSession {
  portalUrl: string;
}

export interface BillingPlanPrice {
  plan: Exclude<PlatformPlan, "free">;
  priceId: string | null;
  currency: string | null;
  unitAmount: number | null;
  interval: string | null;
  intervalCount: number | null;
  productName: string | null;
  configured: boolean;
}

export interface BillingPlansCatalog {
  billingEnabled: boolean;
  publishableKey: string | null;
  plans: BillingPlanPrice[];
}

export interface BillingCheckoutSessionStatus {
  status: string;
  paymentStatus: string;
  plan: PlatformPlan | null;
  checkoutSessionId: string;
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

export function getBillingPlans(signal?: AbortSignal): Promise<BillingPlansCatalog> {
  return request({ method: "GET", url: "/billing/plans", signal });
}

export function createBillingCheckout(
  plan: Exclude<PlatformPlan, "free">,
  options: { uiMode?: CheckoutUiMode; idempotencyKey?: string } = {},
): Promise<BillingCheckoutSession> {
  const idempotencyKey = options.idempotencyKey ?? newIdempotencyKey();
  return request({
    method: "POST",
    url: "/billing/checkout",
    data: { plan, uiMode: options.uiMode ?? "elements" },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getBillingCheckoutSessionStatus(
  sessionId: string,
  signal?: AbortSignal,
): Promise<BillingCheckoutSessionStatus> {
  return request({
    method: "GET",
    url: "/billing/checkout/session",
    params: { sessionId },
    signal,
  });
}

export function createBillingPortal(): Promise<BillingPortalSession> {
  return request({ method: "POST", url: "/billing/portal" });
}

export function cancelBillingSubscription(): Promise<BillingStatus> {
  return request({ method: "POST", url: "/billing/cancel" });
}

/** Extract domain reason from a billing API conflict (e.g. subscription_past_due). */
export function billingErrorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const errors = (error as { errors?: Array<{ reason?: string }> }).errors;
  const reason = errors?.[0]?.reason;
  return typeof reason === "string" ? reason : undefined;
}
