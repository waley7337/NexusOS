# NexusOS Master Completion Checklist

Evidence snapshot: **2026-10-15** against `main` @ `1f230fa880f53f59cc94d6c01deb4e3d9128b446`.

Legend: **PASS** verified in this session · **FAIL** broken · **BLOCKED** cannot verify / intentionally withheld · **DONE** already merged earlier

---

## Phase 1 — Cleanup and verification

| Item | Status | Evidence |
|------|--------|----------|
| PR #25 structlog / CI collection fix on `main` | **PASS** | Merged `df5760e`; security tests annotate loggers as `object` (not `BoundLoggerLazyProxy`) |
| Ruff unused-imports branch `fix/ruff-app-unused-imports` / `6b52fc5` | **DONE** | PR [#27](https://github.com/waley7337/NexusOS/pull/27) merged as `d434544` |
| Expenses audit branch | **DONE** | PR [#26](https://github.com/waley7337/NexusOS/pull/26) merged as `a35e0c9` |
| Local Ruff (`ruff check app --ignore F401,F541,F841`) | **PASS** | Exit 0 on `1f230fa` |
| CI backend gate (local, clean `nexus_test` @ `c6d7e8f9a0b1`) | **PASS** | `138 passed` (security + tenant isolation + invoice/reports/CORS regressions) |
| Frontend typecheck / test / build | **PASS** | `tsc --noEmit` OK; `344` vitest passed; `npm run build` OK |
| GitHub Actions on PR/main heads | **BLOCKED** | `gh`/Actions check-runs API returns **403** for this token |
| Vercel preview (ruff branch) | **PASS** | Deployment READY for `6b52fc5` |
| Vercel production for latest `main` | **BLOCKED** | Observed BUILDING/READY for `#26`/`#27`; confirm READY for `1f230fa` in dashboard |

---

## Phase 2 — Backend defects (invoices / reports / schema)

| Item | Status | Evidence |
|------|--------|----------|
| Reproduce invoice `sent_at` failure | **PASS** | Local `abos`: `ERROR: column "sent_at" does not exist` before repair |
| Alembic history head | **PASS** | Repo head = `c6d7e8f9a0b1` |
| Root cause | **PASS** | Local `abos.alembic_version` = orphan `036eaa06e6d8` (not in repo) → upgrade blocked; finance migration `d1e2f3a4b5c6` never applied. Secondary orphan: `sessions.last_activity` NOT NULL (not in model/migrations) |
| Local/test DB repair | **PASS** | Stamped `abos` → `c4e8f1a2b3d6`, `alembic upgrade head` → `c6d7e8f9a0b1`; dropped orphan `sessions.last_activity`; recreated `nexus_test` at head |
| Healthy local `nexus` DB | **PASS** | Already at `c6d7e8f9a0b1` with `sent_at`/`voided_at` |
| Production migration | **BLOCKED** | No prod migration run (policy). Confirm Railway/prod `alembic_version` = `c6d7e8f9a0b1` and `invoices.sent_at` exists before claiming prod fixed |
| Regression test | **PASS** (this PR) | `tests/test_invoice_schema_columns.py` + CI gate include |
| Finance API suite (local) | **PASS** | `91 passed` (invoices, payments, stripe checkout/webhooks/billing services, expenses, reports enum) |
| Reports enum/CORS regressions | **PASS** | Covered by CI gate + PR #25 |

---

## Phase 3 — Finance and billing closure

| Item | Status | Evidence |
|------|--------|----------|
| Invoice payment summary UI | **PASS** | `InvoicesPage` / detail use API `amountPaid`/`outstandingBalance`; frontend tests assert no client recompute |
| Void hidden for `partially_paid` / paid / void | **PASS** | `InvoiceDetailPage` + `InvoicesPage.test.tsx` |
| Customer filtering | **PASS** | List query `customerId`; UI filter + tests |
| Access gates (`invoices.read` / `invoices.update`) | **PASS** | Route + void button permission tests |
| Invoice create/list/status/payment API | **PASS** | Backend `tests/test_invoices_api.py` + payments suite (in finance run) |
| SaaS subscription / checkout / portal / cancel (roles) | **PASS** (code + fail-closed) | Owner/Admin: `settings.*` via `*`. Manager seed: **no** `settings.view`/`settings.manage`, **no** `payments.*` (intentional). Checkout returns **503** when `STRIPE_BILLING_ENABLED=false` |
| Stripe enablement | **BLOCKED** | Keep `STRIPE_BILLING_ENABLED` / `STRIPE_TENANT_PAYMENTS_ENABLED` **false** until test keys, price IDs, webhooks, Connect profile, E2E verified |
| Live Stripe E2E | **BLOCKED** | No test-mode credentials exercised in this session |
| Expenses audit remnants | **DONE** | Merged via #26; do not reopen without new defect |

---

## Phase 4 — Final gate

| Item | Status | Evidence |
|------|--------|----------|
| Focused + CI regression suites | **PASS** | See Phase 1–2 local results |
| Diff hygiene (no secrets / .env / .vercel) | **PASS** | Untracked `.env.local` / `.vercel/` left uncommitted |
| Mark Finance/Billing complete | **FAIL** (not yet) | Stripe still disabled; prod schema unverified; Actions API blocked |

---

## Remaining blockers

1. **Production DB**: verify `alembic_version = c6d7e8f9a0b1` and `invoices.sent_at` / `voided_at` (operator-run only).
2. **GitHub Actions visibility**: token lacks `checks:read` / Actions access (403).
3. **Stripe test-mode prerequisites** before flipping enable flags (see `docs/ops/Stripe-Payments-and-Billing.md`).
4. **Manager SaaS billing access**: Managers lack `settings.manage` by design — Owners/Admins only unless product expands seed matrix.
5. **Tax/VAT, Connect market matrix, entitlement mapping**: documented business blockers in Stripe ops guide.
