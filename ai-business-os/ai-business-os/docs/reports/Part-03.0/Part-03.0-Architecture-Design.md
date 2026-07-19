# Part 03.0 — Architecture Design

**Linear:** WAL-9  
**Reconstruction date:** 2026-07-19

## Evidence Statement

This report is a retrospective engineering reconstruction produced after implementation.

Its contents are derived exclusively from repository evidence.

It is not a contemporaneous engineering document.

No engineering events are fabricated.

Where repository evidence is unavailable, that limitation is explicitly documented.


## Objective

Design the enterprise database architecture: entity relationships, tenant-aware structure, indexing strategy, delete semantics, and RBAC shape.

## Architecture reconstructed from repository evidence

### Tenancy architecture

* `TenantMixin.company_id` FK → `companies.id` ON DELETE CASCADE
* Child tables carry `company_id` even when reachable through a parent
* `BaseRepository._base_query()` enforces `company_id` filter and raises `TenantIsolationError` if missing

### Domain architecture

Entity map documented in `docs/product/database.md` (mermaid ER diagram) covering:

* Identity/RBAC: companies, users, permissions, roles, role_permissions, user_roles
* CRM: customers, contacts, leads, deals, meetings, customer_notes
* Projects: projects, tasks, task_comments, task_attachments
* HR: employees, leave_requests, attendance
* Finance: invoices, invoice_items, payments, expenses
* Inventory: products, warehouses, inventory/stock, suppliers, purchase_orders
* Platform: documents, notifications, audit_logs, activities, AI conversations/messages/reports, workflows/steps

### Index architecture

Composite indexes leading with `company_id` for tenant-scoped list hot paths (documented in `database.md`; materialized as 150 indexes in initial migration).

### Delete architecture

ON DELETE matrix in `database.md` (company cascade; financial RESTRICT; user-owned SET NULL).

### RBAC architecture

```
permissions (global) ← role_permissions → roles (per-company)
                                         ↑ user_roles
                                       users
```

53 seeded `<module>.<action>` permissions; five system roles (Owner/Admin/Manager/Employee/Viewer).

## Repository evidence

* `docs/product/database.md`
* `backend/app/models/base.py`, `user.py`, domain model modules
* `backend/app/repositories/base.py`
* `backend/app/db/seed.py`
* Migration `0a961c2ea2cf`
* Commit `838db64`

## Outcome

A coherent multi-tenant architecture ready for physical modeling and implementation.

## Evidence limitations (shared)

* Part 03.0 code primarily landed in git commit `838db64` (2026-07-09) under the commit message “chore: validate and stabilize backend foundation”, bundled with broader foundation scaffolding. There is no separate contemporaneous commit uniquely titled “Part 03.0”.
* Linear issues WAL-7…WAL-17 were created on 2026-07-18 as a historical execution hierarchy after the schema already existed in the repository.
* No contemporaneous Part-03.0 independent-review finding IDs, meeting notes, or signed review PDF exist in the repository (unlike Part 03.1’s report pack).
* Structural integrity remediations (composite cross-tenant FKs, soft-delete-safe unique indexes, missing `created_by`/`updated_by` FKs) are **Part 03.1** evidence (`f521d38`, revisions `3a2aec52f6d2` / `217e90d00cc0`) and are not attributed as silent Part 03.0 remediations.
