# NexusOS Master Completion Checklist

Evidence snapshot: **2026-10-15** post-merge `main` @ `3b7f37e6e1ea095f142586cde82a7083037117ac` (PR [#28](https://github.com/waley7337/NexusOS/pull/28) head `438f71a398e5a00ecb9bf66b248a960c122b004c`); docs follow-up branch `docs/master-completion-checklist-post-28` (PR [#29](https://github.com/waley7337/NexusOS/pull/29)).

Legend: **PASS** verified in this session · **FAIL** broken · **BLOCKED** cannot verify / intentionally withheld · **DONE** already merged earlier

---

## Phase 1 — Cleanup and verification

| Item | Status | Evidence |
|------|--------|----------|
| PR #25 structlog / CI collection fix on `main` | **PASS** | Merged `df5760e`; security tests annotate loggers as `object` (not `BoundLoggerLazyProxy`) |
| Ruff unused-imports branch `fix/ruff-app-unused-imports` / `6b52fc5` | **DONE** | PR [#27](https://github.com/waley7337/NexusOS/pull/27) merged as `d434544` |
| Expenses audit branch | **DONE** | PR [#26](https://github.com/waley7337/NexusOS/pull/26) merged as `a35e0c9` |
| Invoice schema regression PR | **DONE** | PR [#28](https://github.com/waley7337/NexusOS/pull/28) merge commit `3b7f37e` (squash into `main`) |
| Local Ruff (`ruff check app --ignore F401,F541,F841`) | **PASS** | Exit 0 prior to merge; CI backend job re-ran on `main` |
| CI backend gate (GitHub Actions) | **PASS** | `main` run [38760973396](https://github.com/waley7337/NexusOS/actions/runs/38760973396): backend success (includes `tests/test_invoice_schema_columns.py`) |
| Frontend typecheck / test / build | **PASS** | Same run: frontend success; local `InvoicesPage.test.tsx` **18 passed** on `main` |
| GitHub Actions on PR/main heads | **PASS** | PR run [38760952627](https://github.com/waley7337/NexusOS/actions/runs/38760952627) success @ `438f71a`; main run success @ `3b7f37e` |
| Vercel / Railway deploy statuses on `main` | **PASS** (commit status) | Combined status success: Vercel Deployment completed; `loving-flow - NexusOS` Success — api.nexuops.com |
| Vercel production dashboard confirmation | **BLOCKED** | Operator: confirm READY for `3b7f37e` in Vercel UI if required beyond commit status |

---

## Phase 2 — Backend defects (invoices / reports / schema)

| Item | Status | Evidence |
|------|--------|----------|
| Reproduce invoice `sent_at` failure | **PASS** | Local `abos`: `ERROR: column "sent_at" does not exist` before repair |
| Alembic history head | **PASS** | Repo head = `c6d7e8f9a0b1`; CI applies migrations end-to-end |
| Root cause | **PASS** | Local `abos.alembic_version` = orphan `036eaa06e6d8` (not in repo) → upgrade blocked; finance migration `d1e2f3a4b5c6` never applied. Secondary orphan: `sessions.last_activity` NOT NULL (not in model/migrations) |
| Local/test DB repair | **PASS** | Local schema regression suite green on `nexus_test` (`5 passed` including HTTP list) |
| Healthy local `nexus` / `nexus_test` DB | **PASS** | Schema tests assert head + `sent_at`/`voided_at` |
| Production schema verify (read-only) | **PASS** | Railway `loving-flow` / production Postgres (read-only): `alembic_version=c6d7e8f9a0b1`; `invoices.sent_at` + `voided_at` exist (`timestamptz`, nullable). **No** prod migration or data write performed |
| Production migration (write) | **BLOCKED** / N/A | Not required given head match; policy remains no agent-run prod migrations |
| Regression test | **PASS** | `tests/test_invoice_schema_columns.py`: local **5 passed**; also on CI gate |
| Finance API suite (local) | **PASS** | Combined invoices/payments/expenses/Stripe fail-closed: **133 passed** |
| Reports enum/CORS regressions | **PASS** | Covered by CI gate + PR #25 |

---

## Phase 3 — Finance and billing closure

| Item | Status | Evidence |
|------|--------|----------|
| Invoice payment summary UI | **PASS** | `InvoicesPage` / detail use API `amountPaid`/`outstandingBalance`; FE tests assert no client recompute (`18` tests green) |
| Void hidden for `partially_paid` / paid / void | **PASS** | `InvoicesPage.test.tsx` + BE void-with-payments rejection |
| Customer filtering | **PASS** | List query `customerId`; UI filter + FE/BE tests |
| Access gates (`invoices.read` / `invoices.update`) | **PASS** | Route + void button permission tests |
| Invoice create/list/status/payment API | **PASS** | Local invoices + payments + schema HTTP list; CI migration + schema gate |
| SaaS subscription / checkout / portal / cancel (roles) | **PASS** (code + fail-closed) | Owner/Admin via `*`; Manager seed lacks `settings.*` / `payments.*` (intentional). Checkout **503** when Stripe billing disabled |
| Stripe enablement | **BLOCKED** | Keep `STRIPE_BILLING_ENABLED` / `STRIPE_TENANT_PAYMENTS_ENABLED` **false**. Defaults in `config.py` / `.env.example` |
| Stripe test keys / secrets | **BLOCKED** | No `STRIPE_*` vars on Railway NexusOS service; local `.env` / `.env.local` have no Stripe secrets. Missing: `STRIPE_PLATFORM_SECRET_KEY` (`sk_test_…`), `STRIPE_PLATFORM_PUBLISHABLE_KEY` (`pk_test_…`), webhook secrets, `STRIPE_PRICE_{STARTER,PRO,ENTERPRISE}` |
| Live Stripe E2E | **BLOCKED** | Cannot run checkout/webhook/portal/cancel without test credentials; Stripe intentionally left disabled |
| Expenses audit remnants | **DONE** | Merged via #26; do not reopen without new defect |

---

## Phase 4 — Final gate

| Item | Status | Evidence |
|------|--------|----------|
| Focused + CI regression suites | **PASS** | PR #28 + `main` Actions green; local FE invoices **18** + BE finance suite **133** (incl. schema **5**) |
| Diff hygiene (no secrets / .env / .vercel) | **PASS** | Untracked `.env.local` / `.vercel/` left uncommitted |
| Mark Finance/Billing complete | **FAIL** (not yet) | Invoice/schema path closed (incl. prod read-only verify). **Stripe still disabled / no test keys** → Live Stripe E2E and enablement remain BLOCKED |

---

## Remaining blockers (operator-only)

1. **Stripe test-mode prerequisites** (exact blocker — do **not** flip enable flags yet):
   - Add **test** Dashboard secrets to Railway (and Vercel publishable if needed): `STRIPE_PLATFORM_SECRET_KEY`, `STRIPE_PLATFORM_PUBLISHABLE_KEY`, `STRIPE_PLATFORM_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` / `_PRO` / `_ENTERPRISE`.
   - Configure webhooks: `POST {API}/api/v1/webhooks/stripe/platform` and `…/connect` (see `docs/ops/Stripe-Payments-and-Billing.md`).
   - Complete Connect platform profile for tenant invoice payments.
   - Only then run test-mode checkout / portal / cancel E2E and consider `STRIPE_BILLING_ENABLED` / `STRIPE_TENANT_PAYMENTS_ENABLED`.
2. **Manager SaaS billing access**: Managers lack `settings.manage` by design — Owners/Admins only unless product expands seed matrix.
3. **Tax/VAT, Connect market matrix, entitlement mapping**: documented business blockers in Stripe ops guide.
4. Optional: confirm Vercel production READY for `3b7f37e` in the dashboard if commit-status alone is insufficient for release sign-off.

### Prod schema note (resolved for verify)

Read-only Railway production Postgres already at `c6d7e8f9a0b1` with `invoices.sent_at` / `voided_at`. No migration action needed unless a future deploy drifts.
