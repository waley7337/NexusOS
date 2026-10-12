# NexusOS Portfolio — Waley El-Nagdi

Personal portfolio built **on** the NexusOS frontend rather than beside it. The design tokens, the star-entry cinematic (`SpaceField` + `Starfield`), the ambient atmosphere and the UI primitives are compiled straight from `../ai-business-os/ai-business-os/frontend/src`. Nothing in NexusOS is copied or modified.

```bash
cd nexusos-portfolio
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm test           # vitest
```

## How the reuse works

| Mechanism | Where |
|---|---|
| `@/…` resolves to the **NexusOS** `src/`; `~/…` resolves to this package's `src/` | `vite.config.ts`, `tsconfig.app.json` |
| The NexusOS Tailwind config is the **preset** | `tailwind.config.ts` |
| NexusOS `globals.css` is imported first, then `src/styles/portfolio.css` | `src/main.tsx` |
| Bare packages imported by NexusOS files (react, zustand, clsx, radix, fonts…) resolve from **this** `node_modules` | `vite.config.ts` (`dedupe` + aliases), `tailwind.shared-modules.ts` |
| The one path that couples the two builds | `nexus.config.ts` |

The star-entry is the real NexusOS auth cinematic. `src/animations/StarEntry.tsx` plays LoginPage's part: it calls `useUiStore.getState().armAuthEntry()` and swaps to the portfolio after `CINEMATIC_CARD_EXIT_MS`. `SpaceField` (mounted in `App.tsx`, outside the content, as in NexusOS) then lifts, travels and clears on its own timeline. `src/components/PortfolioShell.tsx` reuses AppLayout's `data-reveal` / `data-entry` logic, so the shell resolves through the product's own `app-shell-resolve` keyframe. Reduced motion follows the original 220 ms cross-fade path.

Intro behaviour: the intro is shown once per browser session. Deep links (`/#cv`) skip it, `?intro=1` forces it, and the sidebar has **Replay star entry**.

## Structure

```
public/
  brand/                         NexusOS logo + wordmark (copied from the NexusOS public/)
  documents/cv/                  CV (original PDF) + first-page preview
  documents/project-summaries/   NexusOS portfolio summary
  documents/technical-documentation/  NexusOS case study
  images/{system,architecture,security,multi-tenancy}/
                                 original PNGs (byte-identical) + *.preview.webp
src/
  animations/StarEntry.tsx       intro door → NexusOS cinematic
  components/                    shell, nav, folder explorer, preview dialog, PDF preview
  sections/                      Hero, NexusOS, Architecture, Library, CV, Education, Projects, Contact
  data/assets.ts                 asset registry (drives the library, CV and education)
  data/profile.ts, nexusos.ts    copy taken from Waley's own documents
tests/                           registry/privacy guard, star-entry wiring, app smoke
```

## Adding material

1. Put the file under `public/documents/<folder>/` or `public/images/<category>/` (use kebab-case names).
2. For images and PDFs, generate a preview next to it:
   - image: `ffmpeg -i x.png -vf scale=1800:-1 -c:v libwebp -quality 82 x.preview.webp`
   - PDF: `pdftoppm -r 110 -png -f 1 -l 1 -singlefile x.pdf /tmp/p && ffmpeg -i /tmp/p.png -c:v libwebp -quality 85 x.preview.webp`
3. Add an entry to the right folder in `src/data/assets.ts`. A new folder is a new object in `folders`.
4. `npm test`. It fails if a published file is missing, or if a **withheld** file has been placed in `public/`.

Planned slots that don't have material yet: `public/videos/nexusos/` (demo video), database/ER diagrams, test reports, changelogs, and the rest of the screenshot set listed in the screenshot manifest.

### Withheld documents

The degree certificate (Université de Strasbourg, 2020) is listed as **available on request** and is *not* in this repository. It shows the date and place of birth, the diploma number and signatures. To publish it, add `public/documents/education/licence-etudes-anglophones-strasbourg-2020.pdf` (plus a `.preview.webp`) and set `status: "published"` on `degree` in `src/data/assets.ts`.

## Deploying to Vercel

1. **New Project** → import `waley7337/NexusOS`.
2. **Root Directory:** `nexusos-portfolio`. The framework (Vite), install command, build command and output (`dist`) come from `vercel.json`.
3. Under *Root Directory*, keep **"Include files outside of the Root Directory in the Build Step"** enabled (the default). The build reads NexusOS source from `../ai-business-os/ai-business-os/frontend`.
4. No environment variables, backend, database or credentials are needed. The site is fully static.

`vercel.json` adds `X-Robots-Tag: noindex` to `/documents/*` so the CV PDF is not indexed by search engines (it is still downloadable from the site).

## Limits

- If NexusOS renames or moves `styles/globals.css`, `components/space-field.tsx`, `components/starfield.tsx`, `lib/auth-cinematic.ts`, `stores/ui.ts` or the UI primitives used here, this build fails loudly. Update the import or `nexus.config.ts`.
- `app-navigation.tsx`, `AppLayout.tsx` and `LoginPage.tsx` are bound to react-router, react-query, auth and the API client, so their markup and timing are mirrored here rather than imported.
