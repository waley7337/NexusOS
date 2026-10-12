/**
 * NexusOS project copy, taken from Waley's README, website copy and case
 * study. Status wording is kept exactly as precise as the source: what is
 * implemented, what is prepared, what is not built.
 */

export const nexusos = {
  subtitle:
    "A multi-tenant business platform built in the unfashionable order — identity, authorization and tenant isolation first, product modules second.",
  summary: [
    "Business software fragments because every capability arrives with its own idea of who the user is, which company they belong to, and what they're allowed to do. NexusOS answers those three questions once, at the platform layer.",
    "The straightforward path would have been to ship a CRM and retrofit multi-tenancy later. That path is faster to a demo and structurally hard to recover from — so the sequence was inverted: identity, permission and isolation layers were built and tested first, and product modules inherit them rather than reimplement them.",
  ],
  role: "Sole engineer — system architecture, backend, frontend, database design, security engineering, design system, test suite and CI pipeline.",
  highlights: [
    {
      title: "Tenant scope is derived, never accepted",
      body: "Authenticated requests carry no tenant header, path segment or body field. Company identity is read from the caller's stored record on every request.",
    },
    {
      title: "Authorization is re-derived from the database",
      body: "Role and permissions are loaded fresh on every protected request and fail closed — revocation takes effect on the next request, not at token expiry.",
    },
    {
      title: "Refresh-token reuse is treated as compromise",
      body: "Refresh tokens rotate against server-side session records; replaying a spent token revokes every session for that user and writes an audit event.",
    },
    {
      title: "Isolation is enforced twice",
      body: "Application-level scoping plus composite foreign keys — (id, company_id) — that make a cross-tenant relationship unrepresentable in the database.",
    },
    {
      title: "Layered request security",
      body: "CORS allowlisting with production startup validation, security headers, Redis-backed rate limiting, and a trusted-proxy boundary for IP-based controls.",
    },
    {
      title: "A design system built as infrastructure",
      body: "157 design tokens and 31 components with a living style-guide route — the same system this portfolio is built on.",
    },
  ],
  status: {
    headline:
      "NexusOS is an actively developed software platform with core modules implemented and further development ongoing.",
    implemented:
      "Platform: multi-tenant identity model, full authentication lifecycle, RBAC with database re-validation, the security middleware layer, and the frontend shell with its design system. CRM: tenant-safe APIs and workspaces for customers, contacts, leads and deals, plus customer timeline notes. HR: an Employees API and workspace (list and detail).",
    partial:
      "HR covers employee records only so far. The dashboard shows live API and database probes, but its operations panel has no metrics source yet, and its module field still marks only CRM as operational.",
    future:
      "Projects, tasks, finance, inventory, documents, reports, settings and the AI assistant (routed today as honest placeholders), plus PostgreSQL row-level security. Tenant isolation is currently application-level and relational.",
    asOf: "As of main @ 879e442 · HR Part 07.4",
  },
  stack: [
    { label: "Frontend", value: "React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS, Radix UI" },
    { label: "Backend", value: "Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Alembic, Argon2, PyJWT" },
    { label: "Data", value: "PostgreSQL 16 via asyncpg, Redis 7 for rate-limit counters" },
    { label: "Infra & tests", value: "Docker Compose, GitHub Actions CI, pytest, Vitest + Testing Library, ruff, mypy" },
  ],
  interfaceNote:
    "Current design, captured from the running NexusOS frontend against a local API stub with a demo identity — no production data. The full set of fifteen screens is in the library under System & interface.",
  architecture: {
    system:
      "Routers stay thin and delegate to services. Identity is resolved by dependencies rather than by each endpoint, so a new route cannot accidentally skip it. Every response returns in the same envelope, and one database session per request is committed on success and rolled back on any exception.",
    security:
      "Every layer shown is present and wired in the codebase. The panel listing what is not claimed is the more important half: no row-level security, no issuer validation, no account lockout, no revocation of access tokens before expiry.",
    tenancy:
      "The access token carries a company identifier. It is ignored. The token's subject only locates the user row; every scoping decision is then read from that row. After sign-in, nothing in a request influences its own tenant scope.",
  },
};
