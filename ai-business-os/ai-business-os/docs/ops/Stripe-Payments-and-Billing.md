# Stripe Payments & SaaS Billing — Ops Guide

Live Stripe processing stays **fail-closed** until enablement flags and secrets are set. Do not treat browser redirects as payment confirmation.

## Domain separation

| Domain | Purpose | Stripe account | Enable flag |
|--------|---------|----------------|-------------|
| **Tenant invoice payments** | Customers pay company invoices | **Connect connected account** (direct charges) | `STRIPE_TENANT_PAYMENTS_ENABLED` |
| **NexusOS SaaS billing** | Company pays for NexusOS plans | **Platform** Stripe account | `STRIPE_BILLING_ENABLED` |

Tenant invoice proceeds are **never** routed to the NexusOS platform balance by default. No application fees / commissions are configured in code.

## Required environment variable names

Copy names into your secrets store / Railway / Vercel env — **never commit values**.

```
STRIPE_PLATFORM_SECRET_KEY
STRIPE_PLATFORM_PUBLISHABLE_KEY
STRIPE_PLATFORM_WEBHOOK_SECRET
STRIPE_CONNECT_WEBHOOK_SECRET
STRIPE_API_VERSION                 # optional pin
STRIPE_HTTP_TIMEOUT_SECONDS       # default 30
STRIPE_TENANT_PAYMENTS_ENABLED    # false until ready
STRIPE_BILLING_ENABLED            # false until ready
STRIPE_PRICE_STARTER
STRIPE_PRICE_PRO
STRIPE_PRICE_ENTERPRISE
PAYMENTS_IDEMPOTENCY_TTL_HOURS
FRONTEND_URL                      # used for Checkout / Connect / Portal return URLs
```

## Dashboard setup

### Platform (SaaS)

1. Create Products/Prices for Starter / Pro / Enterprise; paste Price IDs into `STRIPE_PRICE_*`.
2. Webhook endpoint: `POST {API}/api/v1/webhooks/stripe/platform`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Set `STRIPE_PLATFORM_WEBHOOK_SECRET` from the endpoint signing secret.
5. Set `STRIPE_BILLING_ENABLED=true` only after secrets + prices are present.

### Connect (tenant invoices)

1. Enable Connect on the platform Stripe account (Dashboard → Connect, or sandbox `stripe tools enable_connect` / `POST /v1/_unstable/connect/enable` with a preview `Stripe-Version`). New sandboxes reject `Account.create` until this is done.
2. Complete the Connect platform profile (acknowledge loss liability when the platform is `losses_collector`).
3. Webhook endpoint (Connect): `POST {API}/api/v1/webhooks/stripe/connect`
4. Events: `checkout.session.*`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`
5. Set `STRIPE_CONNECT_WEBHOOK_SECRET`.
6. Set `STRIPE_TENANT_PAYMENTS_ENABLED=true` only after Connect is ready.
7. Tenants onboard via Settings → Stripe Connect (`payment_providers.manage`). With `STRIPE_API_VERSION=2026-03-25.dahlia`, connected accounts are created via **Accounts v2** (`POST /v2/core/accounts`); Account Links remain on v1.

## Test vs live

- Use `sk_test_` / `pk_test_` / `whsec_` from the **test** Dashboard until UAT passes.
- Switch to live keys only with `ENVIRONMENT=production` review.
- Never simulate success in application code when credentials are missing.

## Migration order

Apply Alembic revisions in order through:

1. Finance payments foundation + platform billing profile (existing)
2. Payment state authority + HTTP list index (existing)
3. **`c6d7e8f9a0b1`** — Stripe Checkout uniqueness / pending-provider guards

Do **not** run production migrations from this agent session; operators apply them deliberately.

## Monitoring

- `provider_webhook_events.processing_status` (`received` / `processed` / `failed` / `ignored`)
- Failed webhook rows + Stripe Dashboard delivery logs
- Checkout create failures (structlog: `tenant_checkout_create_failed`, `platform_checkout_create_failed`)
- Companies stuck in Connect `onboarding` / `restricted` without `charges_enabled`

## Authorization (unchanged product rules)

- Finance sidebar: `invoices.read` only (unchanged).
- Invoice Stripe Checkout API: `payments.create` (existing permission; Managers do **not** get it by default).
- Connect onboarding: `payment_providers.read` / `payment_providers.manage`.
- SaaS billing UI/API: `settings.view` / `settings.manage`.
- Manager seed matrix must **not** auto-grant `expenses.*` or `payments.*`.

### Documented access gap (not silently expanded)

Managers can open Finance (`invoices.read`) but cannot start Stripe invoice Checkout without `payments.create`. Granting that is a **business/RBAC decision** outside this Stripe delivery — do not widen `DEFAULT_ROLES` as part of payments work.

## Recovery notes (verified handler behavior)

- Webhook receipts dedupe on `(provider, external_event_id)`; failed rows are reprocessed on Stripe retry.
- Tenant Connect handlers bind `event.account` to the payment’s `payment_provider_accounts.external_account_id` before confirm/fail/refund.
- Platform `customer.subscription.*` snapshots ignore other subscription IDs and will not resurrect a `canceled` profile from a delayed `active`/`past_due` update.
- Platform `invoice.payment_failed` is a no-op when the profile is already `canceled`.
- Tenant `fail_provider_payment` is a no-op once the payment is `completed`/`refunded` (late expiry must not 500-loop).

## Remaining business blockers

- Tax/VAT/GST calculation and Stripe Tax not implemented.
- Platform application fees / revenue share intentionally undefined (must not invent).
- Connect account country / capability matrix beyond Express US defaults needs ops choice per market.
- Entitlement feature gates beyond `PlatformBillingService.require_entitlement()` still need product mapping per module.
- Live end-to-end verification requires real Stripe test/live credentials (not claimed here).
- Manager access to Stripe invoice Checkout (`payments.create`) remains an intentional RBAC gap — do not widen seed roles without product decision.
