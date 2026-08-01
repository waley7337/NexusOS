# NexusOS — Design System (Part 4)

Single source of truth for every screen. Live version: run the app and open **/design** (also in the ⌘K palette). Tokens live in `src/styles/globals.css` + `tailwind.config.ts`; components in `src/components/ui/`.

The rule that makes the system work: **no component uses a value that isn't a token.** Colors, radii, shadows, durations, and z-indexes are all CSS variables — which is also why dark mode is full-parity by construction.

## Surface ladder

Every neutral fill in the product comes from one six-step ladder. The
shadcn-style aliases (`--background`, `--card`, `--muted`, `--secondary`,
`--accent`) are defined as `var()` references *into* it, so the ladder is the
single source of truth and every existing `bg-card` / `bg-muted` class inherits
it unchanged. Use `bg-surface-N` directly when a surface needs an explicit
elevation rather than a semantic role.

| Step | Light | Dark | Used for | Alias |
|---|---|---|---|---|
| `--surface-0` | `#F7F7F7` | `#000000` | Page canvas | `--background` |
| `--surface-1` | `#FFFFFF` | `#080808` | Shell chrome — sidebar, topbar, status bar | — |
| `--surface-2` | `#FFFFFF` | `#0D0D0D` | Card / panel | `--card`, `--surface-glass` |
| `--surface-3` | `#FFFFFF` | `#121212` | Raised / hover / active nav row / tooltip | — |
| `--surface-4` | `#F5F5F5` | `#171717` | Control fill — secondary buttons, keycaps | `--muted`, `--secondary` |
| `--surface-5` | `#ECECEC` | `#1C1C1C` | Control hover | `--accent` |

Dark is 0% saturation throughout — genuinely neutral, measured B−R delta of 0
on both page and card. Depth comes from the shadow/inset/border system, not
from hue. (The LifeOS reference carries a ~1.2% cool tint; that was
deliberately not adopted.)

**Hairlines are translucent**, so a border reads as a lit edge over whatever
surface is beneath it rather than a fixed grey, and three strengths encode
hierarchy. These are complete `rgb()` values carrying alpha, not HSL triplets:

| Token | Light | Dark |
|---|---|---|
| `--line` | `rgb(15 23 42 / 0.10)` | `rgb(255 255 255 / 0.09)` |
| `--line-soft` | `rgb(15 23 42 / 0.06)` | `rgb(255 255 255 / 0.055)` |
| `--line-strong` | `rgb(15 23 42 / 0.16)` | `rgb(255 255 255 / 0.14)` |

`--border` / `--input` remain HSL triplets set to the composited equivalent,
for the call sites that still use `hsl(var(--border))`.

## Color

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--primary` | `#5B51E8` | `#7C74FF` | Accent: text, icons, borders, focus ring, glow |
| `--primary-fill` | `#5B51E8` | `#5B51E8` | Filled controls carrying a white label |
| `--primary-soft` | `#3D30CF` | `#A29BFF` | Emphasis / hover |
| `--success` | `#0F7535` | `#3ECF8E` | Confirmations, positive deltas |
| `--warning` | `#90570A` | `#F5B84B` | Caution states |
| `--destructive` | `#D01F1F` | `#F26D6D` | Destructive actions, errors |
| `--info` | `#096699` | `#38BDF8` | Informational callouts |
| `--foreground` | `#0F172A` | `#EDEDED` | Text primary |
| `--muted-foreground` | `#5A6577` | `#A3A3A3` | Text secondary |
| `--disabled-foreground` | `#94A3B8` | `#6B6B6B` | Text disabled |

**Why the primary is two tokens.** The contrast requirement inverts between
themes: on near-black the accent must be *light* to be legible as text
(`#7C74FF` measures 5.44:1 on a card), while white on that same violet is only
3.62:1 — below AA for a 14px button label. So `--primary` is the accent and is
mode-aware, `--primary-fill` is the deep violet reserved for filled controls,
and `--primary-foreground` is mode-aware to match. Both roles pass AA in both
themes. The LifeOS reference ships the 3.62:1 button; that defect was not
copied.

**Why the light-mode semantics are dark.** They do double duty — the fill
behind `*-foreground` text *and* the text colour for tinted badges and delta
pills (`text-success` on `bg-success/10`). They had only ever been audited in
the first role; as text, success measured 3.52:1. The binding case is the
tinted backdrop, not paper, so each value is set against that.

Chart series are re-tuned away from the violet so no series can be mistaken for
the brand — `--chart-1` was previously byte-identical to `--primary`, which is
much of why the UI read as monochrome blue. Hues now span 207 / 172 / 27 / 329
/ 83 / 292.

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

- `.surface` — the elevated-panel recipe: ladder fill + translucent hairline + inset top highlight + deep drop shadow, at `--radius-surface` (18px). This is what `Card` renders. Before it existed, Card was `rounded-xl border bg-card` and measured `boxShadow: none` — **no card in the product cast a shadow**, which was the single biggest reason the UI read as flat.
- `.surface-raised` — the same recipe one step up the ladder, for a surface sitting on top of another surface (the command palette).
- `.surface-glass` — 72%-opacity fill + backdrop blur + `shadow-lg`. Opt-in only, for floating surfaces; never data-dense content.
- `.card-lift` — restrained hover elevation: `translateY(-2px)`, border to `--line-strong`, `--shadow-lift`. Opt-in via `Card interactive`, because a grid where every card lifts reads as noise.
- `.spotlight` — pointer-tracked radial highlight, positioned from `--mx`/`--my` written by `useSpotlight`. Defaults to 50%/0% so the class is safe without the hook.
- `.glow-banner` — radial glow marking the one dominant focal point, bound to `--glow-primary` at 10%.
- `.grid-field` — barely-visible 44px structural grid with a radial mask, for hero panels.
- `.eyebrow` / `.num` / `.kbd` / `.focus-ring` — see Typography below.
- `.pulse-live` / `.drift` — live-status pulse and 14s ambient drift; both switched off under `prefers-reduced-motion`.

Composed shadow tokens: `--shadow-surface` (inset highlight + drop) and
`--shadow-lift`, exposed as `shadow-surface` / `shadow-lift` / `shadow-inset`.

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
| StatCard / Sparkline / RadialGauge (Part 04, Phase 7) | `stat-card.tsx` / `sparkline.tsx` / `radial-gauge.tsx` | icon chip + delta pill + trend line; hand-drawn SVG sparkline (not Recharts — see §Dashboard Framework); RadialGauge ships a screen-reader text-equivalent alongside its SVG |
| ProgressListItem / ChecklistCard (Part 04, Phase 8) | `progress-list-item.tsx` / `checklist-card.tsx` | row-level primitives for lists of tracked work — title/description + `Progress` bar; checkbox + label + optional trailing `Badge` tag. Consumers compose rows inside their own `Card` |

### Application Shell (Part 04, Phase 5)

`AppLayout` sidebar/topbar evolved additively — no restructuring, no routing change:

- **Nav grouping:** `NAV_ITEMS` (`constants/routes.ts`) carries an optional `group: "primary" | "more"`. Primary items render inline; `"more"` items collapse under a "More modules" disclosure with a count badge. Icon-only (collapsed) sidebar renders everything flat. `PALETTE_PAGES` (⌘K) is unaffected — it stays a flat list.
- **Active nav state:** `bg-primary/10 text-primary`, replacing the earlier flat `bg-secondary` treatment (Design Constitution principle 15 — color communicates state).
- **SystemStatusBar:** mounted in the sidebar footer, sourced by `useSystemStatus()` (reads the dashboard query's existing cache — no new network call) and `useLiveClock()`.
- **Notification trigger:** the Bell button opens a real `Drawer` with an `EmptyState` — panel content ships in Phase 9.
- **Capture:** a "+Capture" button opens a `Dialog` listing `useCaptureActions()` (real entries as of Phase 6 — see below), scrollable past ~6 items.

### Command Palette & quick actions (Part 04, Phase 6)

- **Registry:** `useCaptureActions()` (`hooks/useCaptureActions.ts`) is now the single source of truth for two generic actions — "Toggle theme" and one "go to X" entry per `PALETTE_PAGES` page — read by both the Capture dialog and the command palette's "Go to"/"Actions" groups. "New customer" remains a palette-only stub (not a generic action, so it isn't in the shared registry).
- **Surface:** the palette is now `.surface-glass` + `ring-primary/15` (a glow-tinted border), replacing the earlier plain `bg-card` surface — the Surface System's `.surface-glass` (Phase 2) applied to its first non-`Card` consumer.
- **Selected-item state:** `bg-primary/10 text-primary`, matching the sidebar's active-nav restyle (Phase 5A) so both "you are here" (nav) and "this is selected" (palette) read as the same visual language.
- **Unchanged:** keyboard shortcuts (⌘K/Ctrl+K), fuzzy search, the `CommandPaletteProvider`/`CommandPaletteItem` contract (`command-palette-types.ts`) — Part 6+ entity-search providers plug into the same, untouched extension point.

### Dashboard Framework (Part 04, Phase 7)

Dashboard's hero (`pages/dashboard/DashboardPage.tsx`) matches the visual language established across Phases 1–6 — glow-banner surface, live `StatusPill`/clock, `PageHeader`, `.chart-1..6` palette — applied to NexusOS's own business content, not copied content:

- **Hero card:** `Card` + an absolutely-positioned `.glow-banner` overlay (same technique as the `/design` Surfaces demo), containing a `StatusPill`+live-clock row, `PageHeader` (greeting title, directive with an emphasized phrase, "Begin weekly review"/"Capture" actions), a quarter-progress `Progress` bar, and a `RadialGauge` (business "Health" score across Sales/Finance/Ops/Team/Product/Support — the six `--chart-1..6` colors) with three compact readouts (Runway/Capacity/Q3 plan) underneath.
- **KpiGrid:** internals swapped to render `StatCard` (icon chip + delta pill + sparkline) instead of its old plain markup — external prop shape (`kpis?: Kpi[]`) unchanged, so `DashboardPage`'s call site didn't change. Icon/sparkline colors cycle the `--chart-1..6` palette by card position.
- **Capture, unified:** the hero's own "+Capture" button opens the *same* sheet as the topbar's — `isCaptureOpen` moved from `AppLayout`'s local state into `stores/ui.ts` (Phase 5's `isNotificationPanelOpen` shape) so a sibling route component can open it too.
- **Loading state:** every dynamic piece of the hero (directive, progress bar, gauge, metrics) renders its own skeleton while `useDashboard()` is pending — same "no spinners" contract every other widget already follows. `StatusPill` even shows a real `"Syncing"` state during load, since `useSystemStatus()` reads the same query's live cache state, not a hardcoded label.
- **Sparkline is plain SVG, not Recharts:** at the small size used here (embedded in a grid cell), Recharts' `ResponsiveContainer` relies on `ResizeObserver` timing that doesn't reliably fire on first paint inside a CSS grid and rendered nothing in real-browser testing — a hand-drawn path with `viewBox` scaling has no such dependency.
- **Unchanged:** `RevenueChart`, `PipelineChart`, `ActivityFeed`, `UpcomingMeetings`, `AiInsights` — every existing chart/list widget below the hero, and the `useDashboard()` query key/shape Part 6+ will eventually swap for a real endpoint.

### Component Library Evolution (Part 04, Phase 8)

- **`ProgressListItem` / `ChecklistCard`:** new row-level primitives (see table above) — wrap the existing `Progress`/`Checkbox`/`Label`/`Badge` components rather than reinventing them. Demoed in `/design`'s new "Component library" section.
- **`useCountUp` (`hooks/useCountUp.ts`):** animates a number from 0 to its target over 600ms on mount — the LifeOS-style number reveal. Lives in `hooks/`, not `lib/motion.ts`, matching this codebase's actual convention (one hook per file for anything stateful; `lib/motion.ts` holds only declarative `Variants`/`Transition` constants). Reuses the existing `useMediaQuery` hook for its `prefers-reduced-motion` check — under reduced motion the target value renders immediately, no animation (Design Constitution §10: motion communicates state, it never bypasses reduced-motion).
- **`StatCard` + `useCountUp`:** `StatCard`'s `value` animates only when it's a plain integer string (`/^\d+$/` — e.g. "23", "3"); pre-formatted values ("$128,430", "11.4mo") render statically. Animating a reformatted currency string mid-flight was judged real added complexity for what the Constitution asks to stay a restrained, legible reveal — not a data-model change.
- **`staggerSection` (`lib/motion.ts`):** a `Variants` preset for page-level sections (hero, KPI row, chart row, activity row) — same per-child 200ms `transition`/`fadeInUp` token already used by `/design`'s `staggerChildren`, just a larger stagger interval suited to a handful of big chunks instead of many small list items. Wired into `DashboardPage`'s four top-level sections.
- **jsdom gap fixed:** `useMediaQuery`/`useCountUp` are real, shipped dependencies of `StatCard` now (not a one-off), so `test/setup.ts` gained a permanent `window.matchMedia` stub (jsdom doesn't implement it) — defaults to "no match" (motion not reduced); tests that care about reduced-motion override it themselves.

## LifeOS Visual Convergence (Part 04, Commits A–G)

A visual-system correction applied after Phase 8, using an attached LifeOS
build as the concrete reference. No backend, API contract, route, auth rule,
business logic or mock dataset was touched — the whole correction lives in the
frontend visual layer.

### What was actually wrong (measured, not asserted)

| Finding | Evidence |
|---|---|
| One surface, not a hierarchy | Sidebar, hero and all 12 dashboard cards measured the identical `rgb(26,26,26)` on a `rgb(15,15,15)` page |
| Nothing had depth | `boxShadow: "none"` on every card, hero included; six shadow tokens existed but `Card` consumed none |
| Blue was structural, not accent | `--chart-1` was byte-identical to `--primary`, as was `--ring`; active nav was `bg-primary/10 text-primary` |
| Hero wasted its own space | 122px of slack below the left column — 44% of the hero's height — from `items-start` with a 159px column against a 280px one |
| No tabular numerics | KPI values measured `font-variant-numeric: normal`, so the count-up reflowed its card every frame |
| No mono webfont | A mono stack was declared but none loaded; measured fallback to `ui-monospace/SFMono/Menlo` |
| Charts were library defaults | 12px sans ticks, full dashed grid at `--border`, 8px tooltip, both series on `--primary` |
| The "harsh blue outline" was a bug | `useRouteFocus` fell through to focusing `<main tabIndex={-1}>` on every navigation because the h1 lives in a lazy chunk; Chromium painted its platform ring around the content region |
| Command palette scrim never worked | The `fixed inset-0` scrim was inside an element carrying `-translate-x-1/2`, which made it the containing block — measured: no full-viewport overlay existed |
| Ambient drift never ran | `@keyframes drift` shipped without the `.drift` class; measured `animation-name: none` |
| Both webfonts were failing | `rsms.me` and `fonts.googleapis.com` both errored on a restricted network; `document.fonts` reported zero loaded families |

### Motion system

| Preset | Timing | For |
|---|---|---|
| `transition` / `transitionFast` | 200 / 150ms, brand curve | Interaction feedback the user is waiting on |
| `transitionReveal` | 700ms, `--ease-out-expo` | Entrances only |
| `fadeInUp` | opacity + 14px + blur(6px)→0 | Section reveal — the blur is what makes it read as *resolving into place* |
| `fadeInPlain` | opacity, 200ms | Reduced-motion counterpart |
| `staggerSection` | 60ms delay, 80ms interval | Page-level section cascade |
| `useCountUp` | 1.1s, expo-out | Numeric reveal |
| `.card-lift` | 250ms, `translateY(-2px)` | Hover elevation |
| `.drift` | 14s, ~3% travel | Ambient hero backdrop |
| SVG `draw` | 1.1s sparkline, 0.9s gauge + 80ms/spoke stagger | Stroke drawing |

**Reduced motion** is handled in two places, because one is not enough.
CSS covers stylesheet animation: effects that *move* are switched off and
pinned to their finished state explicitly — which cannot fail the way a
0.01ms replay can — while colour/opacity feedback keeps working, with a
blanket cap retained as a backstop. Framer Motion animates through inline
styles from JS and the media query cannot reach it, so `App.tsx` wraps the
tree in `<MotionConfig reducedMotion="user">`; that drops the transform but
*not* `filter`, so `useRevealVariants` additionally swaps in an opacity-only
variant. Verified in a real browser across both preference states.

### Shell

The system status moved out of the sidebar footer into a dedicated `h-8`
monospace bar across the foot of the shell, rendered in exactly one place so
the two can never disagree. The shell became `h-dvh` + `overflow-hidden` with
`<main>` owning the scroll, so the bar stays put; `dvh` rather than `vh` so
collapsing mobile browser chrome cannot push it off-screen, plus
`env(safe-area-inset-bottom)`. It lives in the content column, which makes it
correct for expanded, collapsed and mobile sidebar states with no per-state
handling. Every value is derived from a real signal — `useSystemStatus` reads
`navigator.onLine` and the dashboard query's cache state, giving four honest
states (offline / syncing / sync failed / nominal). Nothing is hardcoded.

### Verification

37/37 responsive + accessibility checks pass: no horizontal overflow at
375/768/1440/1920 in both themes; status bar visible and never overlapping
main at any size; content capped at 1400px; sidebar 270px→64px with the bar
tracking it; mobile drawer opens with the desktop sidebar correctly hidden;
24/24 keyboard tab stops paint a focus indicator with no trap; 132 dark + 131
light text/background pairs all AA; one `h1` with a `1,2,2,2,2,2` outline; the
status region is a polite live region; the gauge keeps its `sr-only` text
equivalent; every button has an accessible name; console clean across all
eight viewport/theme combinations.

## Definition of Done (§4.29)

A component ships only when it is responsive, keyboard navigable, dark-mode complete, built from tokens only, unit tested (`npm test` — Vitest + Testing Library), documented here, and free of console warnings. The `/design` page is the review surface: if it looks wrong there, it's wrong everywhere.
