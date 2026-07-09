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

## Spacing · Radius · Elevation · Motion · Z-index

- **Spacing (§4.6):** 8px system — sanctioned values `4 8 12 16 24 32 40 48 64` (Tailwind `1 2 3 4 6 8 10 12 16`). Never invent gaps.
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

## Definition of Done (§4.29)

A component ships only when it is responsive, keyboard navigable, dark-mode complete, built from tokens only, unit tested (`npm test` — Vitest + Testing Library), documented here, and free of console warnings. The `/design` page is the review surface: if it looks wrong there, it's wrong everywhere.
