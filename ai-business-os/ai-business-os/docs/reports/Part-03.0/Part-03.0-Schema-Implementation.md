# Part 03.0 — Schema Implementation

**Linear:** WAL-11  
**Reconstruction date:** 2026-07-19

## Evidence Statement

This report is a retrospective engineering reconstruction produced after implementation.

Its contents are derived exclusively from repository evidence.

It is not a contemporaneous engineering document.

No engineering events are fabricated.

Where repository evidence is unavailable, that limitation is explicitly documented.


## Objective

Implement the enterprise schema in SQLAlchemy models aligned with the approved multi-tenant model.

## What was implemented

### Model package (`backend/app/models/`)

At Part 03.0 landing (`838db64` `__init__.py`), registered models included Company, User/Role/Permission (+ association tables), CRM, Project/Task, HR, Finance, Inventory, Document, Notification, AuditLog, AI, Workflow, Activity.

> Note: `Session` / `AuthToken` models were added later by Part 02 (migration `382d8497298e`) and appear in the current `__init__.py` — they are **not** Part 03.0 deliverables.

### Mixins and base (`base.py`)

* `Base` with UUID v7 PK + naming convention metadata
* `TenantMixin`, `TimestampMixin`, `SoftDeleteMixin`, `AuditedByMixin`, `ActiveMixin`
* `TenantBusinessMixin` composition

### Repository foundation

`BaseRepository` with tenant-scoped `_base_query()`, soft-delete exclusion, and fail-closed missing `company_id`.

> Later Part 03.1 substantially expanded repository methods (pagination clamps, mass-assignment protection, etc.). Those expansions are Part 03.1 evidence, not Part 03.0.

### Seed

`backend/app/db/seed.py` — 53 permissions from `MODULES`; default role permission patterns.

## Repository evidence

* `backend/app/models/**`
* `backend/app/repositories/base.py` (core tenant filter at `838db64`; later hardened)
* `backend/app/db/seed.py`
* `backend/app/utils/uuid7.py`
* Commit `838db64`

## Validation

Models register with `Base.metadata` for Alembic; initial migration creates 37 tables; isolation tests exercise repository behavior on tenant models.

## Outcome

Enterprise schema implemented in ORM form, ready for migration and authentication to attach.

## Evidence limitations (shared)

* Part 03.0 code primarily landed in git commit `838db64` (2026-07-09) under the commit message “chore: validate and stabilize backend foundation”, bundled with broader foundation scaffolding. There is no separate contemporaneous commit uniquely titled “Part 03.0”.
* Linear issues WAL-7…WAL-17 were created on 2026-07-18 as a historical execution hierarchy after the schema already existed in the repository.
* No contemporaneous Part-03.0 independent-review finding IDs, meeting notes, or signed review PDF exist in the repository (unlike Part 03.1’s report pack).
* Structural integrity remediations (composite cross-tenant FKs, soft-delete-safe unique indexes, missing `created_by`/`updated_by` FKs) are **Part 03.1** evidence (`f521d38`, revisions `3a2aec52f6d2` / `217e90d00cc0`) and are not attributed as silent Part 03.0 remediations.
