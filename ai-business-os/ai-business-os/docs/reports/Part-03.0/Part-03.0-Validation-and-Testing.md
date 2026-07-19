# Part 03.0 — Validation & Testing

**Linear:** WAL-13  
**Reconstruction date:** 2026-07-19

## Evidence Statement

This report is a retrospective engineering reconstruction produced after implementation.

Its contents are derived exclusively from repository evidence.

It is not a contemporaneous engineering document.

No engineering events are fabricated.

Where repository evidence is unavailable, that limitation is explicitly documented.


## Objective

Validate tenant isolation and core schema integrity with automated tests against live PostgreSQL.

## Tests at Part 03.0 landing (`838db64`)

`backend/tests/test_tenant_isolation.py` originally contained **five** tests:

1. `test_tenant_a_cannot_see_tenant_b`
2. `test_get_across_tenants_returns_not_found`
3. `test_querying_tenant_model_without_company_fails_closed`
4. `test_same_email_allowed_in_two_companies`
5. `test_soft_delete_hides_but_keeps_row`

These match the five “Verified guarantees” listed in `docs/product/database.md`.

## Later test expansion (Part 03.1 — not 03.0)

The same file was later expanded (+11 tests) for repository hardening (restore, list_deleted, update protections, pagination, sort allowlist, count/exists, bulk_get, hard_delete). That expansion is Part 03.1 evidence (`f521d38`).

## CI

`838db64` introduced `.github/workflows/ci.yml` running tests against PostgreSQL. Part 03.1 later added Redis, mypy, and `alembic check` steps.

## Repository evidence

* `git show 838db64:ai-business-os/backend/tests/test_tenant_isolation.py`
* Current `backend/tests/test_tenant_isolation.py` (includes later additions — distinguish carefully)
* `docs/product/database.md` § Verified guarantees
* `.github/workflows/ci.yml`

## Outcome

Tenant-isolation invariants became executable regression guards for the enterprise schema.

## Evidence limitations (shared)

* Part 03.0 code primarily landed in git commit `838db64` (2026-07-09) under the commit message “chore: validate and stabilize backend foundation”, bundled with broader foundation scaffolding. There is no separate contemporaneous commit uniquely titled “Part 03.0”.
* Linear issues WAL-7…WAL-17 were created on 2026-07-18 as a historical execution hierarchy after the schema already existed in the repository.
* No contemporaneous Part-03.0 independent-review finding IDs, meeting notes, or signed review PDF exist in the repository (unlike Part 03.1’s report pack).
* Structural integrity remediations (composite cross-tenant FKs, soft-delete-safe unique indexes, missing `created_by`/`updated_by` FKs) are **Part 03.1** evidence (`f521d38`, revisions `3a2aec52f6d2` / `217e90d00cc0`) and are not attributed as silent Part 03.0 remediations.
