# NexusOS — Design System (Part 4)

Single source of truth for every screen. Live version: run the app and open **/design** (also in the ⌘K palette). Tokens live in `src/styles/globals.css` + `tailwind.config.ts`; components in `src/components/ui/`.

The rule that makes the system work: **no component uses a value that isn't a token.** Colors, radii, shadows, durations, and z-indexes are all CSS variables — which is also why dark mode is full-parity by construction.

## Color

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--primary` | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav, focus rings |
| `--success` | `#16A34A` | `#22C55E` | Confirmations, positive deltas |
| `--warning` | `#F59E0B` | `#F59E0B` | Caution states (dark text for AA on amber) |
| `--destructive` | `#DC2626` | `#EF4444` | Destructive actions, errors |
| `--info` | `#0891B2` | `#06B6D4` | Informational callouts |
| `--background` | `#F8FAFC` | `#0B1220` | App background |
| `--card` | `#FFFFFF` | `#111927` | Surfaces |
| `--border` / `--input` | `#E2E8F0` | `#1E293B` | Hairlines, control borders |
| `--muted` | `#F1F5F9` | `#1B2537` | Subtle fills, table header rows |
| `--foreground` | `#0F172A` | `#E2E8F0` | Text primary |
| `--muted-foreground` | `#64748B` | `#94A3B8` | Text secondary |
| `--disabled-foreground` | `#94A3B8` | `#64748B` | Text disabled |

## Tokens 2.0 — Core Platform (Part 04, Phase 1 draft)

Additive tokens for the Core Platform's depth system (glow, glass, chart palette), governed by the NexusOS Design Constitution §9 (Depth System). No existing token above was renamed, removed, or changed in value. Reviewable at `/design` → "Tokens 2.0". This subsection is a running draft, consolidated into the rest of this document in Part 04 Phase 15.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--glow-primary` | = `--primary` | = `--primary` | Radial glow marking the one dominant focal point on a screen (Constitution principle 2) |
| `--glow-success` | = `--success` | = `--success` | Glow emphasis for success/positive-state callouts |
| `--glow-warning` | = `--warning` | = `--warning` | Glow emphasis for warning/attention-state callouts |
| `--surface-glass` | = `--card` | = `--card` | Background for floating/elevated surfaces only (`.surface-glass`), never data-dense content |
| `--surface-glass-border` | = `--border` | = `--border` | Hairline border for glass surfaces |
| `--chart-1` … `--chart-6` | `#2563EB` `#0D9488` `#7C3AED` `#EA580C` `#DB2777` `#4F46E5` | `#3B82F6` `#2DD4BF` `#A78BFA` `#FB923C` `#F472B6` `#818CF8` | Qualitative multi-series palette for charts/gauges (e.g. the Phase 7 RadialGauge) — deliberately distinct from the semantic state colors above |

New utility classes (`globals.css` `@layer components`):

- `.surface-glass` — `--surface-glass` background (72% opacity) + `--surface-glass-border` (60% opacity) + backdrop blur + `shadow-lg`. Opt-in only; solid `--card` remains the default for every existing surface.
- `.glow-banner` — the `.auth-glow` radial-gradient recipe generalized for use outside the auth shell, bound to `--glow-primary`.
- `.pulse-live` — subtle opacity/scale pulse for a live-status indicator; collapses under the existing global `prefers-reduced-motion` rule.

## Typography — Inter, fallback system-ui

| Class | Size / weight | Line height | Tracking |
|---|---|---|---|
| `.text-display` | 36 / 600 | 1.15 | −0.02em |
| `.text-h1` | 24 / 600 | 1.25 | −0.015em |
| `.text-h2` | 20 / 600 | 1.3 | −0.01em |
| `.text-h3` | 18 / 600 | 1.4 | — |
| `.text-h4` | 16 / 600 | 1.5 | — |
| `.text-body-lg` | 16 / 400 | 1.6 | — |
| `.text-body` | 14 / 400 | 1.55 | — |
| `.text-small` | 12 / 400 | 1.5 | — |
| `.text-caption` | 12 / 500 uppercase | 1.5 | +0.06em |
| `font-mono` | — | — | IDs, SKUs, money |

### Type roles — Core Platform (Part 04, Phase 3)

The classes above are *what exists*; this table is *which one to reach for*. Every text role used by Phase 4's `PageHeader` and later phases traces to a row here — no ad hoc sizes.

| Role | Class | Used by |
|---|---|---|
| Eyebrow / overline | `.text-caption` | Small label above a title (Phase 4 `PageHeader` eyebrow slot) |
| Page title | `.text-display` | The one-per-page primary focal point (Design Constitution principle 2) — `PageHeader` title slot |
| Directive / subtitle | `.text-body-lg` | The line under a page title that gives it context — `PageHeader` directive slot |
| Section title | `.text-h2` | Sub-groupings within a page (e.g. `/design`'s `Section` headings) |
| Sub-section title | `.text-h3` | Smaller groupings, dialog/drawer headers |
| Standalone small heading | `.text-h4` | Headings outside a card context |
| Card title | `CardTitle` (`text-sm font-semibold tracking-tight`) | Its own established convention, intentionally smaller than `.text-h4` — cards are dense and quiet by design (Constitution §5 card hierarchy), not a token violation since it's still built from Tailwind's scale |
| Body copy | `.text-body-lg` / `.text-body` | Lead paragraphs vs. default interface/table/form text |
| Metadata / timestamps | `.text-small` | Secondary, recessive information (Constitution §4 "supporting information") |
| Numeric emphasis | `font-mono` | Money, counts, IDs, SKUs — see note below |
| Stat / KPI value | `.text-h1`-scale size + `font-mono` | Large numeric readouts (Phase 7 `StatCard`) — heading-scale size for visual weight, mono for tabular digit alignment |

**Numeric-emphasis audit:** money and counts already render through `font-mono` everywhere in the app (swatch hex values, `DataTable`'s value column). A true monospace family gives every glyph — including digits — identical width by definition, so columns of numbers already align without a separate `tabular-nums` utility. No CSS was added for this; one would be redundant given the existing `font-mono` convention.

## Spacing · Radius · Elevation · Motion · Z-index

- **Spacing (§4.6):** 8px system — sanctioned values `4 8 12 16 24 32 40 48 64` (Tailwind `1 2 3 4 6 8 10 12 16`). Never invent gaps.
- **Page rhythm (Part 04, Phase 4):** every page root uses `space-y-6`; grids and multi-widget rows inside a page use `gap-4`. This is what `DashboardPage` and every module placeholder already do — Phase 4 codifies it as the rule new module pages (Part 6+) follow, rather than each page picking its own gap.
- **Radius (§4.7):** `rounded-btn` 10px · `rounded-input` 10px · `rounded-card` 12px · `rounded-dialog` 16px · avatars full circle.
- **Shadows (§4.8):** `shadow-sm/md/lg/hover/dropdown/modal` — all CSS vars, tuned separately for dark mode.
- **Motion (§4.23):** `duration-fast` 150ms · `duration-base` 200ms · `duration-slow` 250ms, easing `cubic-bezier(0.2,0,0,1)`. Framer presets in `src/lib/motion.ts` (`fadeInUp`, `staggerChildren`, `scaleIn`). Every animation communicates state; `prefers-reduced-motion` collapses all of it.
- **Z-index (§4.27):** sticky 20 → dropdown 30 → overlay 40 → modal 50 → toast 60.

## Component library

| Component | File | Notes |
|---|---|---|
| Button | `button.tsx` | primary/secondary/outline/ghost/danger/success · sm/md/lg/icon · `loading` sets `aria-busy` + disables |
| Input, Textarea, Select | `input.tsx` | one visual language; invalid style driven by `aria-invalid` |
| Field | `field.tsx` | label + control + helper/error; wires `htmlFor`/`aria-describedby`/`role=alert` |
| Checkbox / Radio / Switch | Radix-based | keyboard + SR semantics for free |
| DataTable | `data-table.tsx` | sorting, global search, pagination, bulk select, column visibility, CSV export, empty state |
| Dialog / ConfirmDialog | `dialog.tsx` | focus trap, ESC, 16px radius; destructive confirms use the danger button |
| Drawer | `drawer.tsx` | side panel for detail views & long forms |
| Alert · Badge · Avatar · Progress | — | semantic variants shared with toasts |
| Tabs · Breadcrumb · Pagination | — | arrow-key tabs; windowed page numbers |
| Skeleton · EmptyState · ErrorState | — | the only sanctioned loading/empty/error patterns |
| Toasts | Sonner | **top-right**, auto-dismiss, close button |
| PageHeader (Part 04, Phase 4) | `page-header.tsx` | eyebrow · Display-scale title · directive (emphasis-capable) · actions · reserved status slot; `as="h2"` only for pages that already own their h1 |
| StatusPill / SystemStatusBar (Part 04, Phase 5) | `status-pill.tsx` / `system-status-bar.tsx` | dot + label, `online`/`warning`/`offline`; `online` pulses via `.pulse-live` (§Tokens 2.0), respects reduced motion |

### Application Shell (Part 04, Phase 5)

`AppLayout` sidebar/topbar evolved additively — no restructuring, no routing change:

- **Nav grouping:** `NAV_ITEMS` (`constants/routes.ts`) carries an optional `group: "primary" | "more"`. Primary items render inline; `"more"` items collapse under a "More modules" disclosure with a count badge. Icon-only (collapsed) sidebar renders everything flat. `PALETTE_PAGES` (⌘K) is unaffected — it stays a flat list.
- **Active nav state:** `bg-primary/10 text-primary`, replacing the earlier flat `bg-secondary` treatment (Design Constitution principle 15 — color communicates state).
- **SystemStatusBar:** mounted in the sidebar footer, sourced by `useSystemStatus()` (reads the dashboard query's existing cache — no new network call) and `useLiveClock()`.
- **Notification trigger:** the Bell button opens a real `Drawer` with an `EmptyState` — panel content ships in Phase 9.
- **Capture:** a "+Capture" button opens a `Dialog` listing `useCaptureActions()` — an empty registry today, populated by Part 6+ modules without further `AppLayout` changes.

## Definition of Done (§4.29)

A component ships only when it is responsive, keyboard navigable, dark-mode complete, built from tokens only, unit tested (`npm test` — Vitest + Testing Library), documented here, and free of console warnings. The `/design` page is the review surface: if it looks wrong there, it's wrong everywhere.
