# NexusOS Security Policy

## Security architecture

For the technical description of authentication, authorization, tenant isolation, rate limiting, headers, Stripe webhook verification, and residual risks, see:

**[docs/SECURITY.md](docs/SECURITY.md)**

Related:

- [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Supported Versions

NexusOS is under active development.

Security fixes are applied to the latest `main` branch and subsequent releases.

| Version | Supported |
|----------|-----------|
| `main` | Yes |
| Older branches | No guarantee |

## Reporting a Vulnerability

If you believe you have discovered a security vulnerability, please **do not** create a public GitHub issue.

Prefer:

- GitHub Security Advisories (when enabled on the repository)
- A private contact channel designated by the maintainers

Please include:

- Description of the issue
- Steps to reproduce
- Potential impact
- Suggested mitigation (if known)

## Response Process

Reports should be:

1. Acknowledged
2. Reproduced
3. Assessed for severity
4. Fixed
5. Verified
6. Documented
7. Released in an appropriate update

## Scope (examples)

- Authentication and session management
- Authorization / RBAC
- Multi-tenant data isolation
- JWT handling
- API security (CORS, headers, rate limiting)
- Trusted-proxy handling
- Webhook signature validation
- Input validation and mass assignment
- Dependency vulnerabilities

## Disclosure Policy

Please allow adequate time for investigation and remediation before public disclosure.
