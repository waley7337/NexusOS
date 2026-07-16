# NexusOS — PostgreSQL Row-Level Security (RLS) Decision Note

**Status:** DEFERRED (P2) — application-level tenant isolation remains the primary control.
**Date:** 15 July 2026
**Owner:** Backend/Platform

---

> **Correction (Part 3.1 required remediation pass, addressing independent-review finding ARCH-001 / §22):** the original §2 and §4 of this note claimed *"every query built by `BaseRepository`..."* and *"every existing tenant-owned query, without exception, goes through `BaseRepository`"* as the description of the repository layer's *current, live* contribution to tenant isolation. That claim was inaccurate and has been corrected below. **`BaseRepository` has zero callers in application code today** (`grep -rn "from app.repositories" app/` outside `app/repositories/base.py` itself returns nothing) — it is a tested, tenant-aware repository foundation with no current consumer, not a mechanism any live request path actually runs through. The only live tenant-touching code (`auth_service.py`) uses direct, hand-written queries throughout, by design (login must look up a user by email *before* a tenant context exists, and `BaseRepository` intentionally refuses to query without one). This correction does not change the recommendation in §5 — RLS is still deferred — but for the accurate reason given in §4/§5 below: there is currently no live, reachable, tenant-scoped **list/query** endpoint of *any* kind (repository-backed or not) for RLS to add value against, not because `BaseRepository` is already universally used.

## 1. Question

Should NexusOS enable PostgreSQL Row-Level Security on tenant-owned tables as a second, database-enforced layer of tenant isolation, on top of the existing application-level enforcement (`BaseRepository._base_query()` always filtering by `company_id` for the repository's callers, composite foreign keys preventing cross-tenant relationships)?

## 2. Current state (already implemented, this hardening pass)

Tenant isolation today is enforced at three independent layers — but with an important asymmetry in the first layer's *actual, current* reach:

1. **Repository layer (tested foundation, no live callers yet).** `BaseRepository` unconditionally adds `WHERE company_id = :trusted_company_id` to every query it builds for a `TenantMixin` model, sourced only from server-derived context, and raises `TenantIsolationError` (fail-closed) if that context is missing. This is real, tested (`tests/test_tenant_isolation.py`), and correctly designed — but as of this pass, **no application code calls it**. It currently protects the pattern the first real CRUD/business module will inherit, not a live request path today.
2. **Schema layer** — composite foreign keys (`(child.parent_id, child.company_id) REFERENCES parent(id, company_id)`) make it *structurally impossible* for a child row to reference a parent row in a different tenant, regardless of application-layer bugs. This is live and unconditional, independent of which query layer is used.
3. **Authorization layer** — `get_current_active_user` re-derives `company_id`/role/permissions from the database on every request rather than trusting the JWT, so a stale or forged token claim can't smuggle in the wrong tenant context. This is live today.

The actual live tenant-touching code today (`auth_service.py`) does not use layer 1 at all — it uses direct, narrowly-scoped queries (by primary key or a token hash, never an unscoped tenant list), which is safe for what it does but is not the same thing as "goes through `BaseRepository`". Layers 2 and 3 are the only tenant-isolation controls actually exercised by a live request right now. The question below is evaluated against that accurate baseline, not the original overstated one.

## 3. Benefits of RLS

- A bug in a *new* repository or a raw/ad-hoc query that forgets the `company_id` filter would still be blocked by the database itself.
- Protects against a compromised or careless direct-DB-access tool (a psql session, an ad-hoc script, a future BI/reporting connection) that bypasses the ORM entirely.
- Industry-recognized defense-in-depth pattern for multi-tenant SaaS.

## 4. Costs and risks evaluated

| Concern | Finding |
|---|---|
| **Connection pooling** | asyncpg connections are pooled and reused across requests (`DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`). RLS session variables (`SET app.current_company_id = ...`) would need to be set/reset on *every* checkout/return to avoid one tenant's context leaking into the next request that reuses the same physical connection — a single missed reset is a full cross-tenant data leak, i.e. RLS would introduce the exact failure mode it's meant to prevent if implemented carelessly. |
| **Tenant context propagation** | Every code path that touches the DB (services, migrations, background jobs, seed scripts, the audit sweep in tests) would need to consistently set the session variable before any query — a much larger surface than the current single-choke-point (`BaseRepository._base_query()`). |
| **Background workers** | No worker infrastructure exists yet (§32 — Redis/Celery are declared dependencies but unused). RLS policy design for a not-yet-built subsystem would be speculative. |
| **Administrative/reporting queries** | Legitimate cross-tenant queries (e.g. a future internal admin console, platform-wide metrics) would need an explicit bypass role/policy — added design surface with no current consumer. |
| **Migrations** | Alembic runs as the table owner and typically needs `BYPASSRLS` or superuser semantics to alter tenant tables — another privilege boundary to get right without accidentally leaving the migration role usable by the application at runtime. |
| **Debugging** | A query that "returns nothing" becomes ambiguous — was it correctly RLS-filtered, or a real bug? Increases operational complexity when triaging incidents. |
| **Current actual gap RLS would close** | None found — but for a more specific reason than "every query already goes through `BaseRepository`" (corrected; see banner above). There is currently no live, reachable, tenant-scoped **list/query** endpoint of *any* kind, `BaseRepository`-backed or not — the bug class RLS defends against ("a query that forgot its tenant filter") cannot yet occur because no such query-serving endpoint exists at all. `auth_service.py`'s direct queries operate on `User`/`Session`/`Company`/`AuthToken` scoped by primary key or a token hash — never an unscoped tenant list — so they aren't an instance of that bug class either. |

## 5. Decision

**Do not enable RLS now.**

CURRENT REALITY: no live, reachable request path — repository-backed or direct-query — currently performs an unscoped tenant list/query that RLS would need to backstop. The schema layer (composite FKs) and authorization layer (`get_current_active_user`) are live and already satisfy the stated invariant ("tenant isolation is automatic and fail-closed") for every code path that exists in the codebase today. RLS would add meaningful operational complexity (connection-pool session-variable discipline, migration privilege separation, admin-bypass policy design) to defend against a bug class (a repository or raw query forgetting `company_id`) that:

- is caught by the tenant-isolation and cross-tenant-relationship regression suites (`tests/test_tenant_isolation.py`, `tests/security/test_cross_tenant_relationships.py`) today, and
- cannot yet be triggered by any code path that exists, live-callers-wise, because no tenant-scoped list/CRUD endpoint of any kind has shipped yet.

FUTURE REQUIREMENT: this deferral is conditional on that gap remaining true. The first real business module that ships a tenant-scoped list/CRUD route — whether built on `BaseRepository` or a hand-written query — is the point where "does application-level enforcement remain systematic" must be re-verified against actual shipped code, not assumed. If tenant query paths proliferate across multiple hand-written call sites, if enforcement becomes inconsistent across modules, if compliance requirements demand DB-level isolation regardless of application-layer correctness, or if multiple data-access paths bypass whatever the centralized invariant becomes, RLS should be reconsidered on the merits at that time.

## 6. Trigger conditions to revisit

Re-evaluate RLS if **any** of the following becomes true:

- **The first PR ships a real tenant-scoped list/CRUD route to production** — the single most concrete, nearest-term trigger (added per independent-review §22): this is the moment the "no live tenant-scoped query endpoint exists" premise this deferral rests on stops being true, regardless of whether that route is built on `BaseRepository` or a direct query.
- A direct-DB-access surface is introduced that bypasses whatever the centralized tenant-scoping mechanism is at that time (e.g. an admin BI tool, a read replica exposed to an analytics team, a raw SQL reporting endpoint).
- Background job workers are introduced (Celery/RQ) with tenant-scoped tasks running outside the current per-request dependency-injection flow, where the "always call `get_current_active_user`" discipline doesn't naturally apply.
- A security audit or incident specifically identifies an application-layer tenant-isolation bypass that RLS would have caught.
- Tenant-scoped query paths proliferate across enough independent call sites, or enough hand-written direct queries, that "every tenant query is correctly scoped" can no longer be enforced through code review alone.

If any trigger fires, implement RLS with:

- `SET LOCAL app.current_company_id = ...` scoped to the transaction (not the connection) — `SET LOCAL` is automatically reset at transaction end, sidestepping the pooled-connection leak risk entirely.
- A dedicated non-`BYPASSRLS` runtime role, distinct from the migration role.
- Explicit test coverage proving a forgotten `SET LOCAL` fails closed (returns zero rows), not open.
