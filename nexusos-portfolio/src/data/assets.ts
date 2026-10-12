/**
 * Asset registry — the single list the library, CV and education sections
 * read from. Adding material is: drop the file under public/, add one entry.
 *
 * status
 *   published  file is in public/ and served to every visitor
 *   withheld   file exists but is NOT published (personal data); the UI
 *              shows the entry as "available on request"
 *
 * Withheld files are deliberately not in this repository. To publish one,
 * place it at `src` below and flip its status to "published". An asset with
 * a `notice` renders it beside every open/download control.
 */

export type AssetKind = "pdf" | "image";
export type AssetStatus = "published" | "withheld";

export interface Asset {
  id: string;
  title: string;
  description: string;
  kind: AssetKind;
  status: AssetStatus;
  /** Path under public/ (the real, unmodified file). */
  src: string;
  /** Web-sized preview generated from `src` (first page for PDFs). */
  preview?: string;
  /** Human-readable size and format, shown as machine register. */
  meta: string;
  /** Explanation shown for withheld entries, or what a redacted copy omits. */
  note?: string;
  /** Shown next to every open/download control, before the file is opened. */
  notice?: string;
  /** Provenance badge, e.g. "Original, unmodified" or "Redacted copy". */
  label?: string;
}

export interface Folder {
  id: string;
  label: string;
  description: string;
  group: "Documents" | "Images";
  assets: Asset[];
}

export const DEGREE_PRIVACY_NOTICE =
  "Privacy notice: This original degree certificate contains personal information, including date and place of birth, a diploma number, and signatures. Opening or downloading it will reveal these details.";

const REDACTED_NOTE =
  "Redacted copy. Date of birth and age are removed from the page and the text layer; links to the private NexusOS repository are replaced with the public GitHub profile. The original document is unchanged and not published.";

export const cv: Asset = {
  id: "cv-de",
  title: "Lebenslauf — Waley El-Nagdi",
  description: "Junior Software Developer • Applikationsentwicklung (AQUA). One page, German.",
  kind: "pdf",
  status: "published",
  src: "/documents/cv/waley-el-nagdi-cv-de.pdf",
  preview: "/documents/cv/waley-el-nagdi-cv-de.preview.webp",
  meta: "PDF · 1 page · 6 KB · DE",
};

export const degree: Asset = {
  id: "licence-strasbourg",
  title: "Licence — Université de Strasbourg (2020)",
  description:
    "Licence mention Langues, littératures étrangères et régionales — Département d'études anglophones, mention bien.",
  kind: "pdf",
  status: "published",
  src: "/documents/education/licence-etudes-anglophones-strasbourg-2020.pdf",
  meta: "PDF · 1 page · 361 KB · scanned diploma · FR",
  notice: DEGREE_PRIVACY_NOTICE,
  label: "Original, unmodified",
};

export const caseStudy: Asset = {
  id: "nexusos-case-study",
  title: "NexusOS — Engineering Case Study",
  description: "The full case study: architecture, security model, tenant isolation, decisions and trade-offs.",
  kind: "pdf",
  status: "published",
  src: "/documents/technical-documentation/nexusos-case-study.pdf",
  preview: "/documents/technical-documentation/nexusos-case-study.preview.webp",
  meta: "PDF · 11 pages · 49 KB",
};

const portfolioSummary: Asset = {
  id: "nexusos-portfolio-summary",
  title: "NexusOS — Portfolio Summary",
  description: "Two-page overview of the platform, its engineering highlights and current status.",
  kind: "pdf",
  status: "published",
  src: "/documents/project-summaries/nexusos-portfolio-summary.pdf",
  preview: "/documents/project-summaries/nexusos-portfolio-summary.preview.webp",
  meta: "PDF · 2 pages · 23 KB",
};

export const portfolio2026Redacted: Asset = {
  id: "portfolio-2026-redacted",
  title: "Software Developer Portfolio 2026 (redacted copy)",
  description:
    "The ten-page AQUA / LAP application portfolio: approach, workflow, NexusOS architecture, security, skills and the AQUA pathway.",
  kind: "pdf",
  status: "published",
  src: "/documents/project-summaries/waley-el-nagdi-portfolio-2026-redacted.pdf",
  preview: "/documents/project-summaries/waley-el-nagdi-portfolio-2026-redacted.preview.webp",
  meta: "PDF · 10 pages · 3.9 MB",
  note: REDACTED_NOTE,
  label: "Redacted copy",
};

export const projectSummaryRedacted: Asset = {
  id: "nexusos-project-summary-redacted",
  title: "NexusOS — Project Summary (redacted copy)",
  description: "Four-page project summary: overview, role, development highlights, technology and status as of that version.",
  kind: "pdf",
  status: "published",
  src: "/documents/project-summaries/nexusos-project-summary-redacted.pdf",
  preview: "/documents/project-summaries/nexusos-project-summary-redacted.preview.webp",
  meta: "PDF · 4 pages · 184 KB",
  note: REDACTED_NOTE,
  label: "Redacted copy",
};

const image = (
  folder: string,
  name: string,
  title: string,
  description: string,
  meta: string,
): Asset => ({
  id: name,
  title,
  description,
  kind: "image",
  status: "published",
  src: `/images/${folder}/${name}.png`,
  preview: `/images/${folder}/${name}.preview.webp`,
  meta,
});

export const systemArchitecture = image(
  "architecture",
  "system-architecture",
  "System Architecture",
  "Five layers from the untrusted browser to PostgreSQL and Redis, with the live API surface and implementation status.",
  "PNG · 3600×2082",
);

export const securityArchitecture = image(
  "security",
  "security-architecture",
  "Security Architecture",
  "Seven layered controls applied to every request, cross-cutting controls, and what is deliberately not claimed.",
  "PNG · 3600×2076",
);

export const multiTenantFlow = image(
  "multi-tenancy",
  "multi-tenant-request-flow",
  "Multi-Tenant Request Flow",
  "How one authenticated request establishes identity, authority and tenant scope — and where each becomes authoritative.",
  "PNG · 3600×2083",
);

const CURRENT = "screenshots/current-design";
const shot = (name: string, title: string, description: string) =>
  image(CURRENT, name, title, description, "PNG · 3200×2000 · current design");

/**
 * Captured from the running NexusOS frontend (main @ 879e442) at 1600×1000,
 * 2× pixel ratio, against a local API stub. Earlier-design originals are kept
 * outside public/ in assets/screenshots/legacy/ and are never shown here.
 */
export const currentDesignShots: Asset[] = [
  shot("03-dashboard-dark", "Mission Control — dark", "The dashboard in dark mode: workspace hero, live API and database probes, operations panel and module readiness."),
  shot("15-dashboard-light", "Mission Control — light", "The same workspace in the light theme."),
  shot("01-sign-in", "Multi-tenant sign-in", "The Company URL field is the tenant selector. Shown with a stub demo identity."),
  shot("05-capture-palette", "Capture", "Quick navigation and theme switching from anywhere in the shell; create actions appear as modules ship."),
  shot("02-account-dialog", "Account dialog", "Signed-in identity and workspace. Name, email and company values are blurred."),
  shot("04-dashboard-dark-lower", "Module field", "Every module route with its real state — operational or not — and the platform pillars."),
  shot("06-design-tokens", "Design system — Tokens 2.0", "Neutral ladder, glow tokens, glass surface and the qualitative chart palette."),
  shot("07-design-surfaces", "Design system — Surfaces", "Solid, glass and glow surfaces and the rules for when each is allowed."),
  shot("08-design-layout-shell", "Design system — Layout & shell", "The shared PageHeader and the live-status shell primitives."),
  shot("09-design-surface-ladder", "Design system — Surface ladder", "Six-step surface ladder, two-step accent, chart series and section headers."),
  shot("10-design-dashboard-framework", "Design system — Dashboard framework", "StatCard, sparkline, radial gauge, progress list and checklist components."),
  shot("11-design-typography-buttons", "Design system — Typography", "Type scale, radius and elevation, and the button set."),
  shot("13-design-buttons-forms", "Design system — Buttons & forms", "Button variants and sizes, then the form controls with an inline validation error."),
  shot("12-design-forms-feedback", "Design system — Forms", "Form controls in their default state, leading into feedback components."),
  shot("14-design-feedback", "Design system — Feedback", "Alerts, toast triggers, loading, empty and error states."),
];

/** The four shown inline in the NexusOS section; the library folder holds all of them. */
export const interfaceShots = currentDesignShots.slice(0, 4);

export const folders: Folder[] = [
  {
    id: "cv",
    label: "CV",
    description: "Curriculum vitae, as sent to employers.",
    group: "Documents",
    assets: [cv],
  },
  {
    id: "education",
    label: "Education",
    description: "Degree certificate.",
    group: "Documents",
    assets: [degree],
  },
  {
    id: "project-summaries",
    label: "Project summaries",
    description: "Short-form write-ups of NexusOS, and redacted copies of earlier application documents.",
    group: "Documents",
    assets: [portfolioSummary, projectSummaryRedacted, portfolio2026Redacted],
  },
  {
    id: "technical-documentation",
    label: "Technical documentation",
    description: "Long-form engineering documentation.",
    group: "Documents",
    assets: [caseStudy],
  },
  {
    id: "system",
    label: "System & interface",
    description: "Current-design screenshots of the running NexusOS application.",
    group: "Images",
    assets: currentDesignShots,
  },
  {
    id: "architecture",
    label: "Architecture",
    description: "System-level architecture diagram.",
    group: "Images",
    assets: [systemArchitecture],
  },
  {
    id: "security",
    label: "Security",
    description: "Layered security model.",
    group: "Images",
    assets: [securityArchitecture],
  },
  {
    id: "multi-tenancy",
    label: "Multi-tenancy",
    description: "Tenant isolation and request flow.",
    group: "Images",
    assets: [multiTenantFlow],
  },
];
