# NexusOS documentation index

Portfolio-oriented, evidence-based documentation for the GitHub repository. Application code lives under `ai-business-os/ai-business-os/`.

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Repository entry point |
| [NEXUSOS_MASTER_AUDIT.md](NEXUSOS_MASTER_AUDIT.md) | **Authoritative** full-project audit and portfolio sync source |
| [PORTFOLIO_UPDATE_PACKAGE.md](PORTFOLIO_UPDATE_PACKAGE.md) | Ready-to-use portfolio text, diagram specs, PDF checklist |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and request lifecycle |
| [MULTI_TENANCY.md](MULTI_TENANCY.md) | Tenant isolation (application-level; RLS deferred) |
| [SECURITY.md](SECURITY.md) | Security architecture and residual risks |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Module completion status with evidence |
| [portfolio/](portfolio/) | Corrected summary plus preserved original diagrams/text |
| [../SECURITY.md](../SECURITY.md) | Vulnerability reporting policy (not the architecture doc) |

Historical engineering reports (point-in-time; may lag code):

- [`../ai-business-os/ai-business-os/docs/reports/`](../ai-business-os/ai-business-os/docs/reports/)
- [`../ai-business-os/ai-business-os/docs/ops/`](../ai-business-os/ai-business-os/docs/ops/)
- [`../ai-business-os/ai-business-os/docs/engineering/`](../ai-business-os/ai-business-os/docs/engineering/)

**Note:** PNGs under `architecture/` were regenerated to match the master audit (live domain modules; Cloudflare unverified; PostgreSQL RLS not implemented). Older binaries are preserved under `portfolio/_originals/architecture/`.
