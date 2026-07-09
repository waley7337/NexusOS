# Part 5 — Frontend Architecture & Implementation Roadmap

**Project:** NexusOS — AI Business Operating System
**Status:** Approved engineering document
**Audience:** Frontend engineers implementing Parts 6+
**Builds on:** Part 1 (Product Requirements) · Part 2 (Product & UX) · Part 3 (Database & Backend Architecture, `docs/database.md`) · Part 4 (Design System, `docs/design-system.md`)

This document defines *how the frontend is architected* before feature implementation begins. It changes no approved decision from Parts 1–4; where those parts already answer a question, this document cross-references instead of repeating.

---

## 5.1 Objective

Give every engineer the same mental model of the frontend: where code lives, how data flows, how permissions gate UI, and what "done" means — so that ten modules built by different people feel like one product built by one team.

## 5.2 Frontend Goals

The frontend must be modular (each business module is self-contained and deletable), type-safe end to end (API envelope → hook → component, no `any`), API-first (components never know about HTTP), accessible (WCAG AA, keyboard-first per Part 4 §4.26), and fast (Part 2 targets: navigation <200ms, search <100ms, dashboard <1s). Consistency beats cleverness: every list screen is the same DataTable, every form is the same Field composition, every module follows the same folder recipe.

## 5.3 Technology Stack

The stack was fixed in Part 1 and is already in production use in the repository. Rationale per choice:

| Technology | Why it was chosen |
|---|---|
| **React 19** | Component model fits a widget-heavy business UI; largest ecosystem; concurrent features benefit large tables and palettes. |
| **Vite** | Sub-second dev server and fast production builds; `manualChunks` gives us precise bundle control (already splitting react/charts/motion/table). |
| **TypeScript (strict)** | The API envelope, permission strings, and entity types are contracts; the compiler enforces them across module boundaries. |
| **React Router 7** | Client-side routing for an authenticated SPA; nested layouts + loaders cover all our routing needs. |
| **Tailwind CSS** | The Part 4 token system compiles to Tailwind utilities (`rounded-card`, `shadow-modal`, `duration-fast`); styling is constrained to tokens by construction. |
| **shadcn/ui pattern + Radix UI** | We own the component source (Part 4 library) while Radix supplies correct focus management, ARIA wiring, and keyboard behavior for dialogs, tabs, switches, checkboxes, radios. |
| **Zustand** | Minimal global *client* state (auth session, UI preferences) without provider pyramids; persist middleware handles session survival. |
| **TanStack Query** | All *server* state: caching, deduplication, background refresh, optimistic updates, invalidation. Removes 90% of hand-written loading/error plumbing. |
| **React Hook Form + Zod** | Uncontrolled performance for large forms; one Zod schema per form doubles as the type and the validator, mirroring backend Pydantic schemas. |
| **Framer Motion** | State-communicating animation with the Part 4 presets (`src/lib/motion.ts`); respects reduced motion. |
| **TanStack Table** | Headless engine behind our DataTable (Part 4 §4.12): sorting, filtering, selection, visibility — with our markup and tokens. |
| **Recharts** | Declarative charts that inherit CSS variables, so charts are theme-correct in dark mode for free. |
| **Lucide** | One icon style (Part 4 §4.9), tree-shakeable, consistent stroke weight. |
| **Axios** | Central client with interceptors for auth header injection and single-flight refresh (already implemented in `src/api/client.ts`). |

**Decision record — Next.js.** Considered and not adopted. NexusOS is an authenticated application: every meaningful route sits behind login, so SEO/SSR delivers no user value, while SSR would complicate the token-refresh model and deployment (Part 1 ships a static SPA behind NGINX + a FastAPI backend). App-Router benefits (server components, streaming) target content-heavy public sites, not tenant dashboards. Revisit only if a public marketing site is added — as a *separate* Next.js app, not a rewrite. This preserves the Part 1 approved stack, per the "no changes to approved decisions" rule.

## 5.4 Folder Structure

```
frontend/src/
├── api/            # HTTP layer: axios client, interceptors, request<T>() helper.
│                   # The ONLY place that knows HTTP exists.
├── components/
│   ├── ui/         # Part 4 design-system primitives (button, field, data-table…).
│   │               # Zero business knowledge. Zero API calls. Tokens only.
│   └── *.tsx       # App-level shared components (command-palette, …).
├── features/       # Business modules — see §5.5. One folder per module.
├── hooks/          # Cross-module hooks (useDebounce, useMediaQuery, usePermission).
├── layouts/        # AppLayout (shell), AuthLayout. Layout ≠ page: layouts own chrome.
├── lib/            # Pure utilities: cn(), motion presets, formatters. No React state.
├── pages/          # Route entry components. Thin: compose features, own nothing.
├── providers/      # QueryProvider, ThemeProvider — app-wide context, mounted once.
├── routes/         # Route table + guards (ProtectedRoute, PermissionRoute).
├── stores/         # Zustand stores (auth, ui). Client state only — never server data.
├── styles/         # globals.css: the Part 4 token layer.
├── test/           # Vitest setup and shared test utilities.
└── types/          # Global contracts: ApiResponse, Paginated, ListParams, ids.
```

Dependency direction is one-way: `pages → features → components/ui + api`. `components/ui` imports nothing from `features`. `features` never import each other's internals (see §5.5). Violations are review blockers.

## 5.5 Feature-Based Architecture

Every business module (CRM, Projects, Tasks, HR, Finance, Inventory, Documents, Reports, AI, Settings) is a folder under `features/` with the same recipe:

```
features/crm/
├── components/   # Module-private UI composed from components/ui
│                 # (CustomerTable, CustomerDrawer, PipelineBoard…)
├── hooks/        # TanStack Query hooks (useCustomers, useCreateCustomer…)
│                 # The ONLY way components obtain server data.
├── services/     # Typed API calls built on api/request<T>() — pure functions,
│                 # no React. (listCustomers(params), createCustomer(dto)…)
├── schemas/      # Zod schemas for forms & payloads; mirror backend Pydantic.
├── types/        # Entity types (Customer, Contact, Lead, Deal) mirroring Part 3 tables.
├── utils/        # Module-specific pure helpers (pipeline math, invoice totals).
├── tests/        # Vitest unit/integration tests for the module.
└── index.ts      # Public surface. Other modules may import ONLY from here.
```

Responsibilities: **services** translate "business verb → HTTP request" and return typed data; **hooks** wrap services in Query/Mutation with cache keys and invalidation; **components** render and call hooks; **schemas** validate at the edge; **types** are the vocabulary. Cross-module needs (e.g. Finance showing a customer name) go through the other module's `index.ts` exports or shared route navigation — never deep imports. This keeps modules independently buildable, testable, and deletable, mirroring the backend's modular monolith (Part 1).

The dashboard feature (`features/dashboard/`, already implemented) is the reference example of the pattern.

## 5.6 Routing Architecture

React Router 7 with a central route table in `routes/index.tsx`.

| Route class | Mechanism | Examples |
|---|---|---|
| Public | Plain routes under `AuthLayout` | `/login`, `/register`, `/forgot-password`, `/verify-email` |
| Protected | `<ProtectedRoute>` gate (redirects to `/login`, preserves intended URL) | everything under the app shell |
| Permission-gated | `<PermissionRoute required="finance.view">` inside protected tree; renders 403 page on failure | `/finance`, `/settings/roles` |
| Dynamic | Path params + module detail pages | `/crm/customers/:customerId`, `/projects/:projectId/tasks/:taskId` |
| Nested layouts | Parent route renders shared chrome + `<Outlet/>` | `/crm` tabs (Customers / Leads / Deals), `/settings` sections |

Rules: route components live in `pages/` and stay thin; deep links must always work (state comes from the URL, not memory); unknown routes redirect to `/`; module routes are lazy-loaded (§5.18).

## 5.7 Layout Architecture

Already implemented in Part 2/4; documented here as the contract. **Root** mounts providers (Theme → Query → Router → Toaster top-right). **AuthLayout** is the centered card for public auth pages. **AppLayout** is the product shell: collapsible sidebar (11 module links, active state, profile + notifications footer), header (sidebar toggle, global search trigger showing ⌘K, theme toggle), and the content outlet with 24/32px page padding. **Breadcrumbs** (Part 4 component) appear on any page deeper than one level — list pages don't need them, detail pages do. **Command Palette** mounts once inside AppLayout and is available on every authenticated screen. Page anatomy inside the outlet is fixed: title row (`text-h1` + primary action, answering "what can I do?"), optional filter/tab row, then content. Widgets are Cards on the dashboard grid (§5.15).

## 5.8 Component Architecture

The design-system library, its tokens, per-component props/variants/states/accessibility notes, and the Definition of Done are specified in **Part 4 (`docs/design-system.md`)** and rendered live at `/design`. That document is the single source of truth; this section adds only the usage rules that govern feature work:

1. Feature components **compose** `components/ui`; they never restyle primitives with one-off colors, radii, or shadows. If a primitive is missing a capability, extend the primitive (with tests + `/design` entry), don't fork it locally.
2. Every list screen uses **DataTable**; every form control goes through **Field** (accessibility wiring is not optional); every destructive action goes through **ConfirmDialog**; detail/edit side-views use **Drawer**, full-page only when a workflow demands it (Part 4 §4.20: prefer inline over modal).
3. Three components remain to be added to the library, scheduled with their first consumer: **Date Picker** (Finance/HR — build on native input + custom popover, keyboard accessible), **File Upload** (Documents — React Dropzone wrapped in tokens, progress via `Progress`), **Rich Text Editor** (CRM notes/Tasks — TipTap with a minimal toolbar). Each ships per Part 4 §4.29 DoD before its module is considered complete.

## 5.9 State Management

Two kinds of state, two tools, never mixed:

**Server state — TanStack Query.** Anything that lives in PostgreSQL is server state: customers, tasks, invoices, notifications, the current user's profile and permissions. Query keys are hierarchical and mirror REST paths: `["customers", params]`, `["customers", id]`, `["projects", id, "tasks"]`. Defaults (already configured): 30s `staleTime`, 1 retry, no refetch-on-focus. Mutations invalidate the narrowest affected keys. **Optimistic updates** are used where latency would be felt — task status drags, checkbox toggles, notification read-marks — with rollback `onError` and a toast per the Part 4 error voice. Pagination uses `placeholderData: keepPreviousData` so tables never flash to skeletons on page change.

**Client state — Zustand.** Auth session (tokens + user, persisted), UI preferences (sidebar collapsed, theme is handled by ThemeProvider), transient cross-component flags (palette open). Rule of thumb: if the backend could ever disagree with it, it's not client state.

**Offline:** the app targets connected use; the contract is graceful degradation, not offline-first. Query's `onlineManager` pauses retries offline; a global banner ("You're offline — changes can't be saved") appears via a `useOnline` hook; mutations fail into the standard ErrorState/toast with Retry.

## 5.10 API Layer

Components never call `fetch` or `axios` directly — the chain is **component → feature hook → feature service → `api/request<T>()`**. The client (`src/api/client.ts`, implemented) owns: auth header injection, **single-flight refresh** on 401 with retry of the original request, envelope unwrapping (`{success,data,message,errors}` → `T` or typed `ApiRequestError`), and a 30s timeout. Error handling policy: services throw; hooks surface `isError`; screens render ErrorState with Retry for query failures and toast for mutation failures — component code never string-matches errors, it uses `ApiRequestError.errors[].code`/`field` (fields map onto Field `error` props). Retry strategy: 1 automatic retry for idempotent GETs (Query default), zero for mutations; user-visible Retry buttons re-invoke `refetch()`. Cancellation: Query passes an `AbortSignal` to every service; services forward it to axios, so navigating away or retyping a search cancels in-flight requests (this is how search stays <100ms without racing).

## 5.11 Authentication Flow

Backed by Part 3's `users` table and the JWT design from Part 1 (`access` carries `sub`, `company_id`, `role`; `refresh` is rotated).

**Login:** `POST /auth/login` → store tokens + user in the auth store → redirect to the originally requested URL (captured by ProtectedRoute) or `/`. **Current user & permissions:** on app boot with a token present, `GET /auth/me` hydrates `["auth","me"]` — profile plus the flattened permission list derived from `user_roles → role_permissions` (Part 3 RBAC); permissions load *before* first render of the protected tree so gated UI never flashes. **Refresh:** transparent, single-flight, in the interceptor; concurrent 401s share one refresh; rotated tokens replace stored ones. **Session expiration:** if refresh fails, the store clears, Query cache is reset (`queryClient.clear()` — tenant data must not survive logout), user lands on `/login` with "Your session expired — sign in to continue." **Logout:** `POST /auth/logout` (revokes the refresh token server-side), then the same local teardown. **Unauthorized (403):** never masked as 404 in the UI — route-level 403 page for navigation, toast for actions. Demo mode (Part 2) is deleted the day the Auth module (Part 6) lands.

## 5.12 Permission-Based UI

The backend is the source of truth — every endpoint re-checks permissions (Part 3 RBAC + Part 1 `require_roles`); frontend gating is UX, not security.

Mechanics: `usePermission("customers.create")` reads the flattened set from `["auth","me"]`; `<Can permission="invoices.send">…</Can>` wraps conditional rendering; `<PermissionRoute>` gates whole routes (§5.6). Policy for the two failure modes: **hide** what the user can never do (a Viewer sees no "Delete customer" — menus stay clean per Part 2's minimalism); **disable with a tooltip** ("Requires the Finance role") only when hiding would break spatial consistency users rely on, e.g. a column of row-actions. Bulk actions check permissions against the selection and explain partial denials. Permission strings are typed as a union generated from the backend catalog (Part 3 seed), so a typo like `"cusomers.read"` is a compile error.

## 5.13 Global Search

The Command Palette (⌘K / Ctrl+K, implemented in Part 2/4) is the single search surface. Architecture: a **provider registry** — each feature registers `{ id, group, search(query, signal), render, onSelect }` from its `index.ts`. Static providers (navigation, actions, theme) resolve instantly; entity providers (customers, projects, tasks, invoices, employees, documents, products, reports, settings) call their module's search service, debounced 150ms, previous request aborted per keystroke (§5.10 cancellation), results grouped under module headings with recent items shown for the empty query. Keyboard contract: ↑/↓ move, ↵ selects, Esc closes, ⌘K toggles; full arrow-key support comes from cmdk. Backend dependency: each module exposes `GET /<module>?search=` (Part 1 API standards) — no dedicated search service until scale demands one; the palette doesn't care which.

## 5.14 Notifications

Three layers with distinct jobs. **Toasts** (Sonner, top-right — Part 4 §4.19) confirm *the user's own actions*: success auto-dismisses, errors persist with Retry where the action is retryable. **The Notification Center** (bell in the sidebar footer → Drawer) lists *things that happened elsewhere* — Part 3's `notifications` table — with `["notifications"]` infinite query, per-item and mark-all read actions (optimistic). **Unread count** is `["notifications","unread-count"]`, polled at 30s initially; the transport upgrades to WebSocket/SSE post-MVP behind the same hook, so consumers never change. Never toast someone else's activity (Part 2: useful, never spam) — that belongs in the center and the activity feed.

## 5.15 Dashboard Architecture

Implemented in Part 2 as the reference feature; the contract: the page is a composition of independent **widgets** (KPI grid, revenue chart, pipeline, activity feed, upcoming meetings, AI insights) on the responsive grid (1 col mobile → 3 col desktop, 12-col spirit of Part 4 §4.22). Each widget owns its skeleton (no page-level spinner, ever), renders from a slice of `["dashboard"]` (one aggregate endpoint keeps first paint <1s; split into per-widget queries only if the payload grows), and fails independently — a broken chart shows a widget-scoped ErrorState, not a dead page. **Quick Actions** (New customer / New task / New invoice) render per §5.12 permissions and deep-link into module create flows. **AI Insights** consumes `GET /ai/insights` (severity + text + optional entity link) and its Review button deep-links to the referenced record.

## 5.16 Frontend Module Implementation Order

Order minimizes rework: identity first, then the modules whose components others reuse.

| # | Module | Purpose | Pages | Key components | Key hooks | API dependencies | Permissions |
|---|---|---|---|---|---|---|---|
| 1 | **Authentication** | Real sessions replace demo mode | Login, Register (company + owner), Forgot/Reset, Verify email | auth forms (Field + Zod) | useLogin, useLogout, useMe, usePermission | `/auth/*` | — |
| 2 | **Settings (core)** | Company profile, members, roles — unblocks RBAC everywhere | Settings home, Members, Roles & permissions, Profile | MembersTable, RoleEditor (permission matrix), InviteDialog | useMembers, useRoles, useUpdateCompany | `/companies`, `/users`, `/roles`, `/permissions` | `settings.*`, `users.*`, `roles.*` |
| 3 | **Dashboard (live)** | Swap Part 2 mock for real aggregates | Dashboard | existing widgets | useDashboard (real) | `/dashboard` | module-level read perms |
| 4 | **CRM** | Customers → contacts → leads → deals pipeline | Customers list, Customer detail (tabs: overview/contacts/activity/invoices), Leads board, Deals | CustomerTable, CustomerDrawer, PipelineBoard (dnd-kit), NoteComposer (TipTap) | useCustomers, useLeads, useMoveLead (optimistic) | `/crm/*` | `customers.*`, `leads.*`, `deals.*` |
| 5 | **Projects & Tasks** | Linear-style work tracking | Projects list, Project board/list/calendar views, Task detail | TaskBoard (dnd-kit), TaskCard, TaskDrawer, ViewSwitcher | useProjects, useTasks, useMoveTask (optimistic) | `/projects/*`, `/tasks/*` | `projects.*`, `tasks.*` |
| 6 | **Finance** | Invoices, payments, expenses | Invoices list/detail/create, Expenses, Payments | InvoiceForm (line items), InvoiceStatusBadge, PaymentDialog, DatePicker (new primitive) | useInvoices, useCreateInvoice | `/finance/*` | `finance.*`, `invoices.*` |
| 7 | **HR** | Employees, leave, attendance | Employees list/profile, Leave requests, Attendance | EmployeeProfile, LeaveApprovalList, AttendanceCalendar | useEmployees, useLeaveRequests | `/hr/*` | `hr.*` |
| 8 | **Inventory** | Products, warehouses, stock | Products, Product detail, Warehouses, Purchase orders | ProductTable, StockLevelIndicator, POForm | useProducts, useStock | `/inventory/*` | `inventory.*` |
| 9 | **Documents** | File management | Documents list, Upload | FileUpload (new primitive), DocumentGrid, PreviewDrawer | useDocuments, useUpload (progress) | `/documents/*`, storage | `documents.*` |
| 10 | **Reports** | Cross-module exports | Reports home, Report detail | ReportCard, ExportMenu (PDF/Excel/CSV), ScheduleDialog | useReports, useExport | `/reports/*` | `reports.*` |
| 11 | **AI Assistant** | Conversational + insights | Assistant (chat), insights everywhere | ChatThread, MessageComposer, InsightCard | useConversation (streaming), useInsights | `/ai/*` | `ai.use` |
| 12 | **Notifications & Workflows** | Center + visual builder | Notification center (drawer), Workflows, Workflow editor | NotificationList, WorkflowCanvas (dnd-kit) | useNotifications, useWorkflows | `/notifications`, `/workflows` | `workflows.*` |

Each module ships end-to-end (pages + hooks + services + tests + permissions) before the next begins — vertical slices, no half-built layers.

## 5.17 Responsive Strategy

Desktop-first (Part 1: business software), degrading gracefully. Breakpoints are Tailwind's: `<640` mobile, `≥640 sm` tablet, `≥1024 lg` laptop, `≥1280 xl` desktop, `≥1536 2xl` ultra-wide (container capped at 1400px so ultra-wide doesn't become 300-character line lengths). Behavior per tier: sidebar is fixed on `lg+`, collapsible; on mobile it becomes a sheet (Drawer) behind a hamburger; DataTables scroll horizontally inside their Card with sticky first column where identity matters; dashboard grids collapse 3→2→1; dialogs go full-screen under `sm`; touch targets meet 44px on coarse pointers. Mobile scope follows Part 2: Dashboard, Tasks, Notifications, CRM read paths, approvals — dense admin screens (role matrix, workflow canvas) are explicitly desktop-only with a friendly notice, not a broken squeeze.

## 5.18 Performance Strategy

Budgets from Part 2 (navigation <200ms, search <100ms, dashboard <1s) are enforced by: **route-level lazy loading** — every `features/*` module behind `React.lazy` so the shell stays light; **bundle splitting** — vendor chunks already isolated (react 35kB gz, charts 108kB, motion 37kB, table 14kB) and charts load only with pages that draw; **prefetching** — hovering/focusing a sidebar link prefetches the route chunk, and list-row hover prefetches the detail query (`queryClient.prefetchQuery`), which is what makes navigation feel instant; **virtualization** — TanStack Virtual added to DataTable when a view exceeds ~200 rows (boards virtualize per column); **memoization** — measured, not sprayed: stable column defs, memoized chart data transforms, `React.memo` on row components; **images** — avatars sized + lazy, uploads thumbnailed server-side (Part 3 storage), everything else is SVG; **skeletons ≠ speed** — they buy perceived time; real time comes from cache-first rendering with background refresh.

## 5.19 Accessibility

WCAG AA is a Part 4 constitutional rule; feature obligations: every interactive element reachable and operable by keyboard (Radix supplies dialog traps, roving tab index, arrow-key groups); focus management on route change (move focus to the page `h1`), on dialog close (return to trigger), and after destructive actions (to a sensible neighbor); ARIA supplied by the primitives (`aria-sort`, `aria-busy`, `role=alert`, `aria-invalid`/`aria-describedby` via Field) — feature code adds names (`aria-label` on icon-only buttons) and landmarks; contrast is guaranteed by tokens (both palettes AA-verified, amber pairs with dark text); drag-and-drop surfaces (boards, workflow canvas) must ship keyboard alternatives (dnd-kit sensors + a "Move to…" menu action). Axe runs in component tests (§5.21); zero violations is part of DoD.

## 5.20 Error Handling

The Part 4 vocabulary applied uniformly. **Loading:** skeletons or Progress only (spinners are banned); each widget/section owns its skeleton; table pagination keeps previous data. **Empty:** EmptyState with why + one CTA ("No customers yet → Create customer"); filtered-to-empty shows "Nothing matches" + clear-filters, never the onboarding empty state. **Error:** ErrorState with plain words + Retry for reads; toast + inline Field errors for writes; error text never exposes status codes or stack traces. **Retry:** buttons call `refetch()`; mutation retry re-submits the same payload. **Offline:** global banner + paused retries (§5.9). **Crash isolation:** an ErrorBoundary per route chunk renders a page-scoped ErrorState and reports to logging — one broken module never takes down the shell.

## 5.21 Testing Strategy

Vitest + Testing Library (installed, in CI). **Component tests** target behavior contracts, not markup snapshots — the Part 4 suites (Button loading semantics, Field a11y wiring, pagination windowing) are the template; every new primitive and every feature component with logic gets one. **Hook tests** render feature hooks against a mocked service layer (MSW at the axios boundary) asserting cache keys, optimistic updates, and rollback. **Integration tests** mount a page with providers + MSW and walk a user flow ("create customer" → row appears, toast fires). **Accessibility tests** run `vitest-axe` on each page-level story; violations fail CI. **E2E** (Playwright, added with the Auth module): the money paths only — login, create customer, create invoice, move task — against the docker-compose stack in CI, tagged `@smoke` for deploy gates. Coverage target: meaningful paths over percentages, but hooks/services in `features/*` hold ≥80% line coverage.

## 5.22 Definition of Done

A frontend module is complete only when all of the following hold: responsive per §5.17 across the four tiers; accessible per §5.19 with zero axe violations; connected to the real backend (no mocks left behind a flag); tested per §5.21 (components, hooks, one integration flow); type-safe (strict TS, no `any`, permission strings typed); built exclusively from design tokens and Part 4 primitives; visually verified against `/design`; console clean (no warnings, no React key/act noise); `tsc --noEmit`, lint, and the full test suite green in CI; and performance budgets met (route chunk lazy-loaded, lists virtualized past 200 rows, navigation feels <200ms with prefetch). The module's PR links this checklist; reviewers block on any unchecked item.

---

*End of Part 5. Next: Part 6 — Authentication module implementation (backend endpoints + frontend module #1 from §5.16).*
