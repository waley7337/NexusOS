# NexusOS Master Completion Checklist

Evidence snapshot: **2026-10-15** against branch `fix/invoice-schema-sent-at-regression` (post-strengthen) → merge target `main` @ `1f230fa880f53f59cc94d6c01deb4e3d9128b446`.

Legend: **PASS** verified in this session · **FAIL** broken · **BLOCKED** cannot verify / intentionally withheld · **DONE** already merged earlier

---

## Phase 1 — Cleanup and verification

| Item | Status | Evidence |
|------|--------|----------|
| PR #25 structlog / CI collection fix on `main` | **PASS** | Merged `df5760e`; security tests annotate loggers as `object` (not `BoundLoggerLazyProxy`) |
| Ruff unused-imports branch `fix/ruff-app-unused-imports` / `6b52fc5` | **DONE** | PR [#27](https://github.com/waley7337/NexusOS/pull/27) merged as `d434544` |
| Expenses audit branch | **DONE** | PR [#26](https://github.com/waley7337/NexusOS/pull/26) merged as `a35e0c9` |
| Local Ruff (`ruff check app --ignore F401,F541,F841`) | **PASS** | Exit 0 on this branch |
| CI backend gate (local, `nexus_test` @ `c6d7e8f9a0b1`) | **PASS** | Security + tenant isolation + invoice/reports/CORS + schema regressions green with finance API suite (`206 passed` combined run) |
| Frontend typecheck / test / build | **PASS** | `tsc --noEmit` OK; `344` vitest passed; `npm run build` OK |
| GitHub Actions on PR/main heads | **BLOCKED** | `gh` GraphQL/Actions check-runs API returns **403** for this token; merge gated on local green + MCP PR status where available |
| Vercel preview (ruff branch) | **PASS** | Deployment READY for `6b52fc5` |
| Vercel production for latest `main` | **BLOCKED** | Confirm READY for post-merge SHA in dashboard (operator) |

---

## Phase 2 — Backend defects (invoices / reports / schema)

| Item | Status | Evidence |
|------|--------|----------|
| Reproduce invoice `sent_at` failure | **PASS** | Local `abos`: `ERROR: column "sent_at" does not exist` before repair |
| Alembic history head | **PASS** | Repo + local `nexus`/`nexus_test` head = `c6d7e8f9a0b1` |
| Root cause | **PASS** | Local `abos.alembic_version` = orphan `036eaa06e6d8` (not in repo) → upgrade blocked; finance migration `d1e2f3a4b5c6` never applied. Secondary orphan: `sessions.last_activity` NOT NULL (not in model/migrations) |
| Local/test DB repair | **PASS** | `nexus`/`nexus_test` at head with `sent_at`/`voided_at`; no prod writes |
| Healthy local `nexus` DB | **PASS** | `alembic_version=c6d7e8f9a0b1`; columns present |
| Production migration | **BLOCKED** | No prod migration run (policy). Operator must confirm Railway/prod `alembic_version` = `c6d7e8f9a0b1` and `invoices.sent_at` / `voided_at` exist |
| Regression test | **PASS** | `tests/test_invoice_schema_columns.py` (alembic head, columns, ORM, HTTP list) + CI gate include |
| Finance API suite (local) | **PASS** | Invoices + payments + expenses + Stripe foundation/checkout fail-closed green |
| Reports enum/CORS regressions | **PASS** | Covered by CI gate + PR #25 |

---

## Phase 3 — Finance and billing closure

| Item | Status | Evidence |
|------|--------|----------|
| Invoice payment summary UI | **PASS** | `InvoicesPage` / detail use API `amountPaid`/`outstandingBalance`; FE tests assert no client recompute |
| Void hidden for `partially_paid` / paid / void | **PASS** | `InvoicesPage.test.tsx` + BE void-with-payments rejection |
| Customer filtering | **PASS** | List query `customerId`; UI filter + FE/BE tests |
| Access gates (`invoices.read` / `invoices.update`) | **PASS** | Route + void button permission tests |
| Invoice create/list/status/payment API | **PASS** | `tests/test_invoices_api.py` + payments suite |
| SaaS subscription / checkout / portal / cancel (roles) | **PASS** (code + fail-closed) | Owner/Admin via `*`; Manager seed lacks `settings.*` / `payments.*` (intentional). Checkout **503** when Stripe billing disabled |
| Stripe enablement | **BLOCKED** | Keep `STRIPE_BILLING_ENABLED` / `STRIPE_TENANT_PAYMENTS_ENABLED` **false** until test keys, price IDs, webhooks, Connect profile, E2E verified |
| Live Stripe E2E | **BLOCKED** | No test-mode credentials exercised |
| Expenses audit remnants | **DONE** | Merged via #26; do not reopen without new defect |

---

## Phase 4 — Final gate

| Item | Status | Evidence |
|------|--------|----------|
| Focused + CI regression suites | **PASS** | See Phase 1–2 local results |
| Diff hygiene (no secrets / .env / .vercel) | **PASS** | Untracked `.env.local` / `.vercel/` left uncommitted |
| Mark Finance/Billing complete | **FAIL** (not yet) | Stripe still disabled; prod schema unverified; Actions API often blocked |

---

## Remaining blockers (operator-only)

1. **Production DB verify** (read-only OK first):
   ```sql
   SELECT version_num FROM alembic_version;
   SELECT column_name FROM information_schema.columns
     WHERE table_name = 'invoices' AND column_name IN ('sent_at','voided_at');
   ```
   Expect `c6d7e8f9a0b1` and both columns. If behind, operator-run only:
   ```bash
   cd ai-business-os/ai-business-os/backend && alembic upgrade head
   ```
   Do **not** stamp past unknown orphan revisions without inspecting the graph.
2. **GitHub Actions visibility**: token needs `checks:read` / Actions access if dashboard confirmation required.
3. **Stripe test-mode prerequisites** before flipping enable flags (see `docs/ops/Stripe-Payments-and-Billing.md`).
4. **Manager SaaS billing access**: Managers lack `settings.manage` by design — Owners/Admins only unless product expands seed matrix.
5. **Tax/VAT, Connect market matrix, entitlement mapping**: documented business blockers in Stripe ops guide.
