# NexusOS — AI Business Operating System

Enterprise multi-tenant Business Operating System. Modular monolith: FastAPI + PostgreSQL backend, React 19 + TypeScript frontend.

> **Status: Part 4 — Design system.** Complete token layer (exact spec colors, type scale, 8px spacing, radii, shadows, motion, z-index), a tested component library (buttons, form fields with wired a11y, dialogs, drawer, tabs, DataTable with sort/search/select/export), and a living style guide at **/design**. See `docs/product/design-system.md`. Previously (Part 3): Full 37-table schema (CRM, Projects, HR, Finance, Inventory, Documents, AI, Workflows, Audit) with UUID v7 keys, per-tenant uniqueness, 200+ indexes, seeded RBAC catalog, and a tenant-isolation test suite that runs against live PostgreSQL in CI. See `docs/product/database.md`. Previously (Part 2): On top of the Part 1 foundation, the app now has its design system, collapsible navigation shell, ⌘K command palette, and a full dashboard (KPIs, charts, activity, AI insights) — all following the UX contract below.

## UX contract (enforced by shared components)

| Rule from the spec | Implementation |
|---|---|
| Skeletons, never spinners | `components/ui/skeleton.tsx` — every widget renders its own skeleton |
| Empty states invite action | `components/ui/empty-state.tsx` — icon + why + one primary button |
| Errors are human + retryable | `components/ui/error-state.tsx` — plain words, Retry button |
| Everything searchable (⌘K) | `components/command-palette.tsx` — modules register providers here |
| Success = small toast | Sonner, bottom-right, auto-dismiss |
| Accessibility | Focus rings on all controls, aria-labels, `prefers-reduced-motion` respected |
| Performance | Route-level code splitting; charts ship as a separate chunk |


## Quick start

```bash
cp .env.example .env        # fill in SECRET_KEY at minimum
docker compose up --build   # full stack: db + redis + api + web
```

Or run pieces locally:

```bash
make api    # backend at http://localhost:8000  (docs at /docs)
make web    # frontend at http://localhost:5173 (proxies /api to backend)
make test   # backend test suite
```

## Architecture at a glance

```
frontend/  React 19 · Vite · TS · TanStack Query · Zustand · Tailwind · shadcn-ready
backend/   FastAPI · SQLAlchemy 2.0 (async) · Alembic · Pydantic v2 · structlog
infra/     Docker Compose · NGINX · GitHub Actions CI
```

### Conventions every module inherits

| Concern | Where | Rule |
|---|---|---|
| Multi-tenancy | `backend/app/repositories/base.py` | Tenant models **cannot** be queried without `company_id`. Fails closed with a CRITICAL log. |
| Data model | `backend/app/models/base.py` | UUID PKs, UTC timestamps, soft deletes, `TenantMixin`. |
| API envelope | `backend/app/schemas/response.py` | `{ success, data, message, errors }` — always. |
| Errors | `backend/app/core/exceptions.py` | Services raise domain errors; one handler maps them to HTTP. |
| Identity | `backend/app/dependencies/auth.py` | JWT carries `sub` + `company_id` + `role`; `require_roles()` for RBAC guards. |
| Observability | `backend/app/middleware/request_context.py` | Every request gets an `X-Request-ID`, bound to all log lines. |
| HTTP client | `frontend/src/api/client.ts` | Auth header, single-flight token refresh, envelope unwrapping. |

### Layering (backend)

```
api (routers)  →  services (business logic)  →  repositories (tenant-scoped data access)  →  models
```

Routers never touch the database. Services never import HTTPException. Repositories are the only layer that builds queries — which is why tenant isolation lives there and only there.

## Roadmap

1. ✅ Part 1 — Foundation: architecture, tenant isolation, security core, CI
2. ✅ Part 2 — Product & UX layer: design system, shell, ⌘K palette, dashboard
3. ✅ Part 3 — Database architecture: 37 tables, RBAC, audit log, isolation tests
4. ✅ Part 4 — Design system: tokens, component library, /design style guide, component tests
5. ✅ **Part 5 — Frontend architecture & roadmap** (this): `docs/product/Part-05-Frontend-Architecture-and-Implementation-Roadmap.md`
6. Part 6 — Auth module: register, login, refresh rotation, email verification
5. Parts 5+ — CRM, Projects, Tasks, HR, Finance, Inventory, Documents, Reports, AI Assistant, Workflows

> Demo mode: until Part 4, the login form creates a local demo session (any valid email + 8-char password) so the entire product is walkable.
