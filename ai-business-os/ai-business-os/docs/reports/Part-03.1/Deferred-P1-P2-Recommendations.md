# NexusOS — Deferred P1/P2 Hardening Recommendations

**Companion to:** `Part-03.1-Backend-Hardening-Completion-Report.md`, `RLS-Decision-Note.md`
**Date:** 15 July 2026

Each item below was evaluated against the actual codebase and deliberately **not implemented now**, per the task's own instruction not to build infrastructure ahead of a concrete requirement. This is the design/trigger record for each.

---

## 1. Database least-privilege (runtime vs. migration roles) — P0 (documentation), P1 (enforcement)

**What:** Distinguish a migration-privileged Postgres role (DDL: `CREATE`/`ALTER`/`DROP`) from a runtime application role (DML only: `SELECT`/`INSERT`/`UPDATE`/`DELETE` on application tables, no schema-mutation rights).

**Current state:** Local dev and CI both connect as a single `nexus` role that owns the schema and runs both migrations and the app. This is normal and low-risk for local/CI.

**Why deferred:** Introducing a second DB role/credential pair into local development "for appearance" would add friction (two connection strings, two sets of grants to keep in sync every migration) with no local-dev security benefit — the task explicitly warns against this ("Do not introduce unnecessary database users into local development merely for appearance").

**Production requirement (must be true before go-live, not deferred there):**
- A distinct `nexusos_migrator` role (owns/can-alter the schema) used only by the deploy pipeline's `alembic upgrade head` step.
- A distinct `nexusos_app` role granted only `SELECT, INSERT, UPDATE, DELETE` on application tables (no `CREATE`/`DROP`/`ALTER`, no ownership) used by the running FastAPI process.
- TLS required for any non-localhost connection (`sslmode=require` or stricter in `DATABASE_URL`).
- Network exposure restricted to the application's VPC/security group — the database must never be reachable from the public internet.
- Automated backups with periodic restore-drill testing (a backup that has never been restored is unverified).

**Trigger to implement:** Before the first production deployment (this is a deploy-configuration concern, not a code change — no application code depends on which role it connects as).

---

## 2. File-upload security — P1 (readiness only, no upload feature exists)

**What:** No file upload endpoint exists anywhere in the current API surface (`app/api/v1/router.py` only wires `health` and `auth`). There is a `Document` model in `app/models/*` reserved for future use, but no upload/download route.

**Required pipeline when a real upload feature is built** (do not build any of this speculatively):

```
Upload → size validation → content/type validation (never trust filename/extension/Content-Type alone) →
server-generated internal object name (never the client-supplied filename) → malware scan (if available) →
private object storage (not a public directory) → authorized, tenant-scoped download only
```

Downloads must re-run the same tenant/resource authorization check as any other `GET` — a signed URL or object key must never be a substitute for an authorization check.

**Trigger:** The first PR that adds an upload endpoint must implement this pipeline before merge, not after.

---

## 3. Optimistic concurrency (version columns) — P1

**What:** No collaborative multi-writer entity currently exists that risks a lost update (no CRUD routes exist yet for Projects/Tasks/Invoices — see repo inspection in the completion report). Adding a `version` column to every table pre-emptively was explicitly discouraged by the task.

**Trigger to implement:** When a specific entity gets a real multi-user edit surface — e.g. Task/Project boards or Invoice editing where two users can plausibly load-then-save the same row concurrently. At that point, add a `version: Mapped[int]` column to *that* table only, increment-on-write, and return `409 Conflict` (already an available `ConflictError` in `app/core/exceptions.py`) on a stale version.

---

## 4. Idempotency — P1

**What:** No payment, webhook, import, or external-integration endpoint currently exists. `AuthToken`/`Session`/`refresh` already have their own correctness mechanism (single-use token rows, `jti` uniqueness) which is a form of idempotency already built into the auth flow (replaying a used token is safely rejected, not double-processed).

**Design standard for when a real at-risk operation is built:**
- Client sends an `Idempotency-Key` header (client-generated UUID).
- Server stores `(company_id, idempotency_key) -> result` with a unique constraint; a retried request with the same key returns the stored result instead of re-executing the side effect.
- Keys expire after a bounded window (e.g. 24h) — not kept forever.

**Trigger:** The first PR that adds payments, webhooks, or an external-integration write path.

---

## 5. Background job security — P1

**What:** `redis` and `celery` are declared dependencies (`requirements.txt`) but **no worker process, task queue, or scheduled job exists in the codebase** — confirmed by inspection (no `celery_app`, no `tasks.py`, no worker entrypoint anywhere in `app/`).

**Design standard for when workers are introduced:**
- Every task payload carries `company_id` explicitly (never re-derive tenant context from "the first row found") and every DB access inside the task goes through the same `BaseRepository` tenant-scoping used by the request path.
- Tasks must be safe to run twice (idempotent, or de-duplicated by a stored idempotency key — see §4).
- Explicit retry policy with bounded backoff and a dead-letter/failure-visibility path (not silent infinite retry).
- Correlation ID (the same `request_id` pattern already used for HTTP requests) threaded into task logs.

**Trigger:** The first PR that adds a Celery task or any async job runner.

---

## 6. Transactional outbox — P2 (documentation only)

**What:** No business operation in the current codebase produces a side effect that requires reliable async delivery (no "create invoice → send email → publish event" chain exists — email sending today, in `EmailService`, is synchronous, logs-only, and already inside the same request as the operation it accompanies).

**Decision:** Do not build outbox infrastructure now. `AUDIT EVENTS` (already implemented, `audit_service.py`) and `DOMAIN EVENTS` (not yet needed) are kept conceptually separate per the task's instruction — the audit log is a compliance/security trail, not a message bus, and must not be repurposed as one later.

**Trigger:** The first business flow that must reliably notify an external system (webhook delivery, a queued email provider, a domain event consumed by another service) after a DB commit, where "best effort, and it's fine if it's occasionally lost" is not acceptable.

---

## 7. Authorization evolution (RBAC → ABAC/policy engine) — P2 (documentation only)

**What:** The current fixed RBAC (`Role` ↔ `Permission`, per-company roles, global permission catalog, `require_permission(...)`) is sufficient for every capability currently in the codebase (auth only; no CRM/Finance/etc. routes exist yet to need resource-level policy beyond tenant + permission).

**Preserved evolution path:** `require_permission()` already only depends on `(user, permission_name) -> bool` resolved from fresh DB state (`get_current_active_user`). Should resource-level rules (e.g. "only the assigned owner can close a deal") become necessary, they can be layered as an additional check *inside* the relevant service function — `can(actor, action, resource, context)` — without touching the existing `require_permission` dependency or its tests.

**Trigger:** A concrete product requirement for a permission that depends on resource state (ownership, status, assignment) rather than just "does this role hold this permission."

---

## 8. Rate limiting scope — P1 (partially implemented this pass)

**Implemented now:** `login`, `register`, `refresh`, `forgot-password`, `reset-password`, `verify-email` — the unauthenticated, high-risk auth surface (see completion report §"Rate limiting").

**Explicitly deferred (no corresponding endpoints exist yet):** AI endpoints, exports, report generation, expensive search, invitations. These do not exist in the current API surface. The `rate_limit(key_prefix, limit=..., window_seconds=...)` dependency factory built this pass is directly reusable — apply it to each such endpoint as it's built, choosing a limit appropriate to that endpoint's cost.

---

## 9. HTTP security headers beyond baseline — P1 (partial)

**Implemented now:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, conditional `Strict-Transport-Security`, `Cache-Control: no-store` default (see `SecurityHeadersMiddleware`).

**Deliberately not implemented:** A real `Content-Security-Policy`. This is a pure JSON API with no server-rendered HTML of its own; a CSP is only meaningful at the layer serving the frontend application (Vercel/reverse proxy), and adding a blanket CSP here would be decorative rather than protective, per the task's own guidance ("do not apply browser headers blindly if they belong at the reverse proxy or frontend hosting layer").

**Trigger:** If this backend ever serves any HTML/rendered content directly (it does not today — `docs_url`/`redoc_url` are dev-only and disabled in production already).
