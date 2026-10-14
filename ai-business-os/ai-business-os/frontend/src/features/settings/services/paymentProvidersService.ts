import { request } from "@/api/client";

export type ProviderConnectionStatus =
  | "pending"
  | "onboarding"
  | "active"
  | "restricted"
  | "disconnected";

export interface StripeConnectStatus {
  accountId: string | null;
  externalAccountId: string | null;
  connectionStatus: ProviderConnectionStatus | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingCompletedAt: string | null;
  paymentsEnabled: boolean;
}

export interface StripeConnectOnboarding {
  accountId: string;
  externalAccountId: string;
  onboardingUrl: string;
  connectionStatus: ProviderConnectionStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export function getStripeConnectStatus(signal?: AbortSignal): Promise<StripeConnectStatus> {
  return request({ method: "GET", url: "/finance/payment-providers/stripe", signal });
}

export function startStripeConnectOnboarding(): Promise<StripeConnectOnboarding> {
  return request({ method: "POST", url: "/finance/payment-providers/stripe/onboarding" });
}

export function syncStripeConnectAccount(): Promise<StripeConnectStatus> {
  return request({ method: "POST", url: "/finance/payment-providers/stripe/sync" });
}
