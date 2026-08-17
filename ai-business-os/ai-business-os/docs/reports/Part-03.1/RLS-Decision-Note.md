# NexusOS — PostgreSQL Row-Level Security (RLS) Decision Note

**Status:** DEFERRED — ACCEPTED ARCHITECTURAL DECISION (Part 06 CRM release, August 2026)  
**Date:** 15 July 2026 (original); reassessed 17 August 2026  
**Owner:** Backend/Platform

---

## Part 06 reassessment (August 2026)

The original revisit trigger in §6 has **fired**: live tenant-scoped CRM CRUD (Customers, Contacts, Leads, Deals, Customer Notes) now ships through `BaseRepository` with server-derived `company_id`, RBAC, composite tenant FKs, and regression suites (`tests/test_*_api.py`, `tests/security/test_cross_tenant_relationships.py`).

After reassessment for the Part 06 CRM release, **RLS remains deliberately deferred**. Application-level tenant isolation is the **authoritative** control for this release:

```
Authenticated request
      ↓
authenticated user (DB-derived, not JWT-trusted for tenant)
      ↓
server-derived company_id
      ↓
RBAC permission enforcement
      ↓
tenant-scoped BaseRepository
      ↓
company_id-scoped queries
      ↓
composite tenant foreign keys
      ↓
PostgreSQL
```

RLS is **future defense-in-depth**, not the primary tenant-isolation mechanism for Part 06. Implementation belongs in a **dedicated security-hardening phase**, not bundled into CRM or another business module.

**No RLS policies, migrations, `SET LOCAL` wiring, DB role splits, or pooling changes are authorized for the Part 06 release.**

### Future proposed architecture (design only — not implemented)

When RLS is revisited, prefer:

```
transaction begins
      ↓
SET LOCAL app.current_company_id = '<tenant UUID>'
      ↓
application queries
      ↓
PostgreSQL RLS policies (USING company_id = current_setting(...))
      ↓
transaction commit/rollback
      ↓
tenant context automatically cleared (SET LOCAL scope)
```

Future implementation should consider:

- `SET LOCAL`, not unsafe persistent session state on pooled connections
- Dedicated application DB role **without** `BYPASSRLS`
- Separate migration/admin role with `BYPASSRLS`
- Fail-closed behavior when tenant context is absent (zero rows, not open)
- Authentication/bootstrap paths where tenant context is not yet known
- Connection pooling safety (asyncpg pool reuse)
- Background workers (when introduced)
- Migrations (`ENABLE ROW LEVEL SECURITY` + policies)
- Integration tests proving cross-tenant reads fail at DB layer
- Cross-module verification, staging rollout, rollback strategy

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

**Do not enable RLS now.** This remains an **accepted architectural decision** for the Part 06 CRM release (see Part 06 reassessment above).

CURRENT REALITY (August 2026): Part 06 CRM ships live tenant-scoped list/CRUD through `BaseRepository`. Tenant isolation for those paths is enforced by server-derived `company_id`, RBAC, repository scoping, composite FKs, and automated regression suites — not by PostgreSQL RLS. RLS would add operational complexity (connection-pool session-variable discipline, migration privilege separation, admin-bypass policy design) as **defense-in-depth** against a bug class (a repository or raw query forgetting `company_id`) that is:

- caught by tenant-isolation and cross-tenant-relationship regression suites today, and
- not currently observed in production or test suites for the shipped CRM surface.

FUTURE REQUIREMENT: if tenant query paths proliferate across inconsistent hand-written call sites, if compliance requires DB-level isolation regardless of application correctness, if direct-DB-access surfaces bypass the ORM, or if a security incident identifies an application-layer bypass that RLS would have caught, RLS should be implemented as a **standalone security-hardening phase** using the future proposed architecture documented above.

## 6. Trigger conditions to revisit

The **first tenant-scoped list/CRUD route** trigger (§6, July 2026) **has fired** with Part 06 CRM. RLS was reassessed and **remains deferred** for that release (see Part 06 reassessment).

Re-evaluate RLS implementation (dedicated phase) if **any** of the following becomes true:

- A direct-DB-access surface is introduced that bypasses application-level scoping (e.g. an admin BI tool, a read replica exposed to analytics, a raw SQL reporting endpoint).
- Background job workers are introduced (Celery/RQ) with tenant-scoped tasks outside the per-request dependency-injection flow.
- A security audit or incident identifies an application-layer tenant-isolation bypass that RLS would have caught.
- Tenant-scoped query paths proliferate across enough independent call sites that "every tenant query is correctly scoped" can no longer be enforced through code review alone.
- Compliance or customer requirements mandate DB-enforced isolation regardless of application-layer correctness.

If implementation is authorized, use the future proposed architecture in the Part 06 reassessment section (SET LOCAL, role split, fail-closed tests) — not persistent session variables on pooled connections.
