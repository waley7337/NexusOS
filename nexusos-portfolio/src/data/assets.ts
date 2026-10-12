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
 * place it at `src` below and flip its status to "published".
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
  /** Explanation shown for withheld entries. */
  note?: string;
}

export interface Folder {
  id: string;
  label: string;
  description: string;
  group: "Documents" | "Images";
  assets: Asset[];
}

const REQUEST_NOTE =
  "Contains personal identifiers (date and place of birth, document number), so it is not published as a public download. Available on request.";

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
  status: "withheld",
  src: "/documents/education/licence-etudes-anglophones-strasbourg-2020.pdf",
  meta: "PDF · 1 page · scanned diploma · FR",
  note: REQUEST_NOTE,
};

const caseStudy: Asset = {
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

export const interfaceShots: Asset[] = [
  image(
    "system",
    "dashboard-dark",
    "Mission Control — dark",
    "The dashboard shell in dark mode: hero, health radar, KPI strip and analytics (fixture data).",
    "PNG · 3744×2319",
  ),
  image(
    "system",
    "dashboard-light",
    "Operations dashboard — light",
    "The same workspace in light mode with the NexusOS brand lockup.",
    "PNG · 3738×2319",
  ),
  image(
    "system",
    "sign-in",
    "Multi-tenant sign-in",
    "Runs against the live API. The Company URL field is the tenant selector, not decoration.",
    "PNG · 3590×2062",
  ),
  image(
    "system",
    "command-capture",
    "Global Capture",
    "Quick-create and module navigation from anywhere, as a modal over the live shell.",
    "PNG · 3731×2307",
  ),
];

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
    description: "Short-form write-ups of NexusOS.",
    group: "Documents",
    assets: [portfolioSummary],
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
    description: "Screenshots of the running NexusOS application.",
    group: "Images",
    assets: interfaceShots,
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
