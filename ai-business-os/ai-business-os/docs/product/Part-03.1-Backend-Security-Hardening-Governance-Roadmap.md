# Part 3.1 — Backend Security Hardening

**Project:** NexusOS — AI Business Operating System  
**Status:** CANONICAL — Repository-authorized retrospective governance (closed; no retrospective Linear expansion)  
**Audience:** Engineers and operators governing Part 3.1 security hardening evidence, Linear hierarchy design, and handoff into Part 3.2  
**Builds on:**

- Part 1 — Foundation (`docs/reports/Part-01/`)
- Part 2 — Authentication production stack (`docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md`)
- Part 3 — Database architecture (`docs/product/database.md`)

**Authority:** Repository product documentation under `docs/product/`.  
Archive roadmaps under `docs/archive/` remain non-governing.  
This document is a **retrospective engineering reconstruction**. The repository is the only source of truth.  
Rejected chat proposals (Proposal A / Proposal B) must not be used to create Linear issues.

**Hard rules:**

- Do **not** invent engineering work not supported by code, tests, reports, or git history.
- Do **not** use prior AI-generated Part 3.1 roadmaps as authority.
- Do **not** claim production readiness from local hardening alone.
- Railway / Vercel being online does **not** mean Part 3.1 production security is verified.

**Evidence baseline commits:** `f521d38` (implementation, tests, migrations) and `5f2a66b` (Part-03.1 report pack + CI / `.env.example` deltas).

**Linear note:** WAL-18–WAL-28 remain the historical execution record (Appendix C). This roadmap is the canonical decomposition. Retrospective expansion into 64 Linear issues was **declined** — do not create that hierarchy.

---

## 1. Purpose

Record, govern, and make auditable the Part 3.1 Backend Security Hardening work that was already implemented and independently verified in the repository.

This roadmap exists so that:

1. Implemented security capabilities are grouped into a durable hierarchy derived from repository evidence.
2. Engineering review, remediation, and independent verification are preserved as first-class governance phases — not collapsed into “done” without traceability.
3. Local hardening completion is stated honestly without overstating deployment or production verification.
4. Deferred residuals and the production handoff into Part 3.2 remain explicit and non-negotiable.

Part 3.1 is **not** a forward planning exercise. It is a governing reconstruction of completed local security hardening plus its review lifecycle.

---

## 2. Scope

### In scope (evidenced in repository)

1. Security requirements / threat-driven hardening checklist captured in the completion report.
2. Schema integrity for cross-tenant relationships and soft-delete-safe uniqueness.
3. Authorization and session hardening (fresh-DB authz, session expiry authority, role determinism).
4. Request context and request-ID sanitization / correlation.
5. Trusted-proxy-aware client IP and scheme resolution.
6. Redis-backed rate limiting on the unauthenticated auth surface.
7. Security headers and production CORS / OpenAPI boundary rules.
8. Audit logging, shared redaction, exception observability, optional Sentry.
9. Production configuration validation (`validate_production_config()`).
10. Secure repository layer preparation (`BaseRepository` guards) with zero production consumers.
11. Security regression suite and CI wiring (Postgres + Redis).
12. Independent engineering review, remediation, minor follow-up, and final verification reports.
13. Deferred decision notes (P1/P2, RLS) and residual risk recording (VERIFY-001).
14. Explicit readiness freeze: Deployment Configuration / Production Deployment / Production Traffic **NOT READY**.

### Explicit non-goals

- Production trusted-proxy configuration for a real edge (owned by Part 3.2).
- Production deployment / traffic verification after Part 3.1.
- Claiming production readiness because hosts are online.
- Implementing deferred P1/P2 items (DB least-privilege enforcement, RLS, uploads, workers, outbox, etc.).
- Reconstructing or synchronizing Linear issues in this authoring phase.
- Building CRM/HR/Finance business modules or new protected CRUD APIs.

---

## 3. Current Engineering Status

| Area | Status |
|---|---|
| Implementation | ✔ **COMPLETE** |
| Engineering Review | ✔ **COMPLETE** |
| Remediation | ✔ **COMPLETE** |
| Independent Verification | ✔ **VERIFIED** |
| Deployment Configuration | ✘ **Deferred to Part 3.2** |
| Production Deployment Verification | ✘ **Deferred to Part 3.2** |
| Production Traffic Verification | ✘ **Deferred to Part 3.2** |
| Production Readiness | ✘ **NOT CLAIMED** |

**Summary:** Local security hardening is complete, reviewed, remediated, and independently verified. Production verification belongs to Part 3.2. Online services must not be treated as production-verified security posture.

Authoritative readiness matrix source: `docs/reports/Part-03.1/Part-03.1-Remediation-Re-Review.md` §19 (Architecture / Security Implementation / Controlled Refactor / Final Validation / Git Freeze **READY**; Deployment Configuration / Production Deployment / Production Traffic **NOT READY**). Follow-up and final verification closed NEW-001/NEW-002/NEW-003 without changing those three **NOT READY** conclusions.

---

## 4. Repository Sources

| Source class | Location / identity |
|---|---|
| Implementation commits | `f521d38`, `5f2a66b` |
| Core security modules | `backend/app/core/client_ip.py`, `backend/app/core/rate_limit.py`, `backend/app/core/redaction.py`, `backend/app/core/config.py`, `backend/app/core/logging.py`, `backend/app/core/exceptions.py` |
| Middleware | `backend/app/middleware/request_context.py`, `backend/app/middleware/security_headers.py` |
| Auth / audit | `backend/app/dependencies/auth.py`, `backend/app/api/v1/auth.py`, `backend/app/services/auth_service.py`, `backend/app/services/audit_service.py` |
| Repository foundation | `backend/app/repositories/base.py` |
| App wiring | `backend/app/main.py` |
| Alembic revisions | `217e90d00cc0` (`backend/migrations/versions/20260715_217e90d00cc0_*.py`), `3a2aec52f6d2` (`backend/migrations/versions/20260715_3a2aec52f6d2_*.py`) — revision IDs, not git commits |
| Security tests | `backend/tests/security/*` (+ related updates in `backend/tests/test_config.py`, `backend/tests/test_tenant_isolation.py`, `backend/tests/test_auth_service.py`) |
| CI / env docs | `.github/workflows/ci.yml`, `.env.example` |
| Completion report | `docs/reports/Part-03.1/Part-03.1-Backend-Hardening-Completion-Report.md` |
| Independent review | `docs/reports/Part-03.1/Part-03.1-Independent-Engineering-Review.md` |
| Remediation | `docs/reports/Part-03.1/Part-03.1-Required-Remediation-Report.md` |
| Re-review | `docs/reports/Part-03.1/Part-03.1-Remediation-Re-Review.md` |
| Minor follow-up | `docs/reports/Part-03.1/Part-03.1-Minor-Security-Migration-Follow-Up.md` |
| Final verification | `docs/reports/Part-03.1/Part-03.1-Final-Follow-Up-Verification.md` |
| Deferred / RLS | `docs/reports/Part-03.1/Deferred-P1-P2-Recommendations.md`, `docs/reports/Part-03.1/RLS-Decision-Note.md` |
| Existing Linear evidence (coarse) | WAL-18 (umbrella) … WAL-28 |
| Downstream ownership | `docs/product/Part-03.2-Deployment-Configuration-and-Production-Verification-Roadmap.md` |

---

## 5. Engineering Summary

Part 3.1 closed concrete local hardening gaps without rewriting the broader architecture:

- Cross-tenant integrity moved into the schema (composite FKs + soft-delete-safe unique indexes).
- Authorization stopped trusting stale JWT role/permission claims beyond `sub`.
- Client identity, rate-limit keys, and HSTS scheme trust were centralized behind a trusted-proxy boundary.
- Audit writes, log redaction, request-ID sanitization, security headers, production config validation, and auth-surface rate limiting were implemented and regression-tested.
- Independent review found HIGH/MEDIUM defects; remediation closed them; minor NEW-* follow-up verified; final verification verdict is **VERIFIED**.

What Part 3.1 did **not** do:

- Identify or set real Railway (or other) edge CIDRs for `TRUSTED_PROXY_*`.
- Produce a superseding production verification report for post–3.1 security posture.
- Claim Deployment Configuration / Production Deployment / Production Traffic readiness.

Those remain Part 3.2.

---

## 6. Canonical Work Breakdown

Work groups below are derived from repository evidence, then split into:

1. **Implementation capabilities** (3.1.1–3.1.11)
2. **Engineering governance lifecycle** (3.1.12–3.1.14)

### IMPLEMENTATION

| Group | Capability | Primary evidence |
|---|---|---|
| 3.1.1 | Security requirements & threat review | Completion report checklist |
| 3.1.2 | Schema & cross-tenant integrity | Models + Alembic revisions `217e90d00cc0`, `3a2aec52f6d2` |
| 3.1.3 | Authorization & session hardening | `dependencies/auth.py`, session tests, SEC-002 |
| 3.1.4 | Request context & request-ID | `request_context.py`, bare-500 path in `main.py` |
| 3.1.5 | Trusted proxy & client IP | `client_ip.py`, `TRUSTED_PROXY_*`, NEW-001 |
| 3.1.6 | Redis rate limiting (auth surface) | `rate_limit.py`, auth route wiring |
| 3.1.7 | Security headers & CORS boundary | `security_headers.py`, CORS / OpenAPI in `main.py` |
| 3.1.8 | Audit, redaction & observability | `audit_service.py`, `redaction.py`, OBS-001, Sentry |
| 3.1.9 | Production configuration validation | `validate_production_config()` |
| 3.1.10 | Repository security foundation | `repositories/base.py`, ARCH-001 |
| 3.1.11 | Security regression suite & CI | `tests/security/*`, CI Redis/Postgres |

### ENGINEERING GOVERNANCE

| Group | Lifecycle phase | Primary evidence |
|---|---|---|
| 3.1.12 | Independent engineering review | Independent Engineering Review report |
| 3.1.13 | Remediation & re-verification | Remediation → Re-Review → Minor Follow-Up → Final Verification |
| 3.1.14 | Deferred decisions & production handoff | Deferred P1/P2, RLS note, VERIFY-001, NOT READY → Part 3.2 |

---

## 7. Hierarchical Issue Structure

**Do not create these Linear issues until separately approved.**  
Rejected Proposal A/B counts do not apply.

### Count summary (authoritative)

| Layer | Count |
|---|---|
| Umbrella issue | **1** |
| Main issues | **14** |
| Sub-issues | **49** |
| **Total** | **64** |

These counts were derived from repository evidence grouping. They must not be optimized for symmetry.

### Status vocabulary (retrospective)

| Status in this doc | Meaning |
|---|---|
| Complete — verified | Implemented and covered by Part 3.1 verification evidence |
| Complete — documented | Decision/deferred note authored; intentionally not implemented |
| Residual — accepted | Known residual recorded; optional future hardening |
| Handoff — Part 3.2 | Explicitly out of Part 3.1 closeout; owned by Part 3.2 |

---

### 3.1 — Umbrella

| Field | Value |
|---|---|
| **Title** | 3.1 — Backend Security Hardening |
| **Objective** | Govern the completed local security hardening pass and its review lifecycle without claiming production verification. |
| **Scope** | §§2–14 of this document |
| **Acceptance criteria** | Definition of Done §9 |
| **Required evidence** | Part-03.1 report pack + commits `f521d38` / `5f2a66b` |
| **Dependencies** | Part 2 auth stack; Part 3 schema foundation |
| **Suggested labels** | `backend`, `security`, `Testing&Verification` |
| **Status** | Implementation + review lifecycle **COMPLETE**; production readiness **NOT CLAIMED** |

---

### IMPLEMENTATION (3.1.1 → 3.1.11)

```
3.1.1  Security Requirements & Threat Review
  ↓
3.1.2  Schema & Cross-Tenant Integrity Hardening
  ↓
3.1.3  Authorization & Session Hardening
  ↓
3.1.4  Request Context & Request-ID Hardening
  ↓
3.1.5  Trusted Proxy & Client IP Boundary
  ↓
3.1.6  Redis Rate Limiting (Auth Surface)
  ↓
3.1.7  Security Headers & CORS Boundary
  ↓
3.1.8  Audit Logging, Redaction & Exception Observability
  ↓
3.1.9  Production Configuration Validation
  ↓
3.1.10 Repository Security Foundation
  ↓
3.1.11 Security Regression Suite & CI
```

---

### 3.1.1 — Security Requirements & Threat Review

| Field | Value |
|---|---|
| **Objective** | Capture the P0/P1 hardening intent that scoped the Part 3.1 implementation. |
| **Scope** | Threat/requirements inventory in the completion report; auth abuse surfaces |
| **Acceptance criteria** | Requirements checklist exists and maps to implemented controls |
| **Required evidence** | Completion report §1 / security checklist |
| **Dependencies** | None |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Capture P0/P1 hardening requirements from threat review | Complete — verified |
| Record unauthenticated / auth abuse surfaces in scope | Complete — verified |

---

### 3.1.2 — Schema & Cross-Tenant Integrity Hardening

| Field | Value |
|---|---|
| **Objective** | Make cross-tenant relationship violations structurally impossible at the database layer. |
| **Scope** | Composite FKs; soft-delete-safe unique indexes; created_by/updated_by FK drift fix |
| **Acceptance criteria** | Migrations at head; DB rejects cross-tenant child→parent links in tests |
| **Required evidence** | Alembic revisions `217e90d00cc0`, `3a2aec52f6d2`; `backend/tests/security/test_cross_tenant_relationships.py` |
| **Dependencies** | 3.1.1 |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Implement cross-tenant composite foreign keys | Complete — verified |
| Implement soft-delete-safe unique indexes | Complete — verified |
| Fix pre-existing created_by/updated_by FK drift migration | Complete — verified |
| Prove cross-tenant relationship rejection in tests | Complete — verified |

---

### 3.1.3 — Authorization & Session Hardening

| Field | Value |
|---|---|
| **Objective** | Ensure authorization and session decisions fail closed on fresh DB state. |
| **Scope** | `get_current_active_user` / `require_permission`; SEC-002 role ordering; session `expires_at` authority |
| **Acceptance criteria** | Stale JWT role trust closed; expired sessions cannot refresh; determinism test present |
| **Required evidence** | `dependencies/auth.py`; `test_authorization.py`; `test_session_security.py` |
| **Dependencies** | 3.1.1 |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Fresh-DB `get_current_active_user` / `require_permission` | Complete — verified |
| Deterministic primary role ordering (SEC-002) | Complete — verified |
| Session `expires_at` authoritative over JWT `exp` | Complete — verified |
| Authorization / session security regression tests | Complete — verified |

---

### 3.1.4 — Request Context & Request-ID Hardening

| Field | Value |
|---|---|
| **Objective** | Sanitize and preserve request correlation IDs across normal and bare-500 paths. |
| **Scope** | `RequestContextMiddleware`; structlog bind; unhandled-exception re-attach |
| **Acceptance criteria** | Unsafe `X-Request-ID` rejected/replaced; 500 path still emits request-ID + security headers |
| **Required evidence** | `request_context.py`; `main.py` exception handler; `test_request_context.py` |
| **Dependencies** | 3.1.1 |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| `RequestContextMiddleware` + `X-Request-ID` sanitization | Complete — verified |
| Bind request-ID into structlog contextvars | Complete — verified |
| Re-attach request-ID + headers on bare 500 path | Complete — verified |
| Request-ID sanitization unit tests | Complete — verified |

---

### 3.1.5 — Trusted Proxy & Client IP Boundary

| Field | Value |
|---|---|
| **Objective** | Centralize client identity resolution behind an explicit trusted-proxy boundary. |
| **Scope** | `resolve_client_identity()`; `TRUSTED_PROXY_MODE` / `TRUSTED_PROXY_NETWORKS`; universal-trust rejection |
| **Acceptance criteria** | Spoofing ignored when peer untrusted; `/0` networks rejected; defaults remain safe (`none` / `[]`) |
| **Required evidence** | `client_ip.py`; `config.py`; `test_client_ip.py`; `test_trusted_proxy_http.py`; `test_trusted_proxy_config.py` |
| **Dependencies** | 3.1.4 |
| **Status** | Complete — verified **in code**; production CIDR values **not** configured (Part 3.2) |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Centralize `resolve_client_identity()` trust boundary | Complete — verified |
| `TRUSTED_PROXY_MODE` / `TRUSTED_PROXY_NETWORKS` settings | Complete — verified |
| Reject universal trust (`/0` and equivalents) — NEW-001 | Complete — verified |
| Unit + HTTP + config validator trusted-proxy tests | Complete — verified |

---

### 3.1.6 — Redis Rate Limiting (Auth Surface)

| Field | Value |
|---|---|
| **Objective** | Protect unauthenticated auth endpoints with Redis fixed-window limits keyed by resolved client identity. |
| **Scope** | `rate_limit.py`; auth route dependencies; fail-open on Redis outage |
| **Acceptance criteria** | Over-limit returns 429; independent budgets; fail-open documented/tested |
| **Required evidence** | `rate_limit.py`; `api/v1/auth.py`; `test_rate_limiting.py`; trusted-proxy HTTP spoof-resistance coverage |
| **Dependencies** | 3.1.5 |
| **Status** | Complete — verified (local/CI); production effectiveness requires Part 3.2 proxy trust |

**Sub-issues (3)**

| Title | Status |
|---|---|
| Redis fixed-window limiter + fail-open policy | Complete — verified |
| Wire rate limits on auth abuse surfaces | Complete — verified |
| Rate-limit unit + spoof-resistance HTTP tests | Complete — verified |

---

### 3.1.7 — Security Headers & CORS Boundary

| Field | Value |
|---|---|
| **Objective** | Apply baseline API security headers and keep CORS / docs boundaries production-safe. |
| **Scope** | `SecurityHeadersMiddleware`; HSTS via trusted scheme; CORS origins; OpenAPI disabled in production |
| **Acceptance criteria** | Baseline headers present; HSTS not spoofable by untrusted peers; production docs/OpenAPI off |
| **Required evidence** | `security_headers.py`; `main.py`; production config tests; HTTP header coverage via security suite |
| **Dependencies** | 3.1.5 |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Baseline security headers middleware | Complete — verified |
| HSTS only via trusted HTTPS scheme | Complete — verified |
| CORS outer boundary + production origin rules | Complete — verified |
| Security-header / CORS HTTP regression tests | Complete — verified |

---

### 3.1.8 — Audit Logging, Redaction & Exception Observability

| Field | Value |
|---|---|
| **Objective** | Persist security-relevant auth events and prevent secret leakage in logs/audit/exceptions. |
| **Scope** | Append-only audit service; shared redaction; OBS-001 production exception logging; optional Sentry |
| **Acceptance criteria** | Auth events audited; secrets redacted; production exceptions include useful traceback without weakening redaction; Sentry PII default off |
| **Required evidence** | `audit_service.py`; `redaction.py`; `logging.py` / exception path; `test_audit_logging.py`; `test_exception_logging.py`; `test_sensitive_data_exposure.py` |
| **Dependencies** | 3.1.4 |
| **Status** | Complete — verified |

**Sub-issues (5)**

| Title | Status |
|---|---|
| Append-only audit service + auth event wiring | Complete — verified |
| Shared redaction for logs and audit payloads | Complete — verified |
| Production exception logging (`format_exc_info`) — OBS-001 | Complete — verified |
| Optional Sentry init (`send_default_pii=False`) | Complete — verified |
| Audit persistence + exception/redaction tests | Complete — verified |

---

### 3.1.9 — Production Configuration Validation

| Field | Value |
|---|---|
| **Objective** | Fail fast on insecure production boot configuration. |
| **Scope** | `validate_production_config()`; production OpenAPI/docs disablement; unit coverage |
| **Acceptance criteria** | Insecure production settings raise; non-production remains no-op for validator; OpenAPI/docs disabled when production |
| **Required evidence** | `config.py`; `main.py`; `tests/test_config.py`; trusted-proxy production validator cases |
| **Dependencies** | 3.1.5, 3.1.7 |
| **Status** | Complete — verified **in code**; real production boot proof deferred to Part 3.2 |

**Sub-issues (3)**

| Title | Status |
|---|---|
| Implement `validate_production_config()` fail-fast | Complete — verified |
| Disable OpenAPI/docs in production | Complete — verified |
| Production-config unit tests | Complete — verified |

---

### 3.1.10 — Repository Security Foundation

| Field | Value |
|---|---|
| **Objective** | Prepare a secure tenant-scoped repository layer for future CRUD adoption. |
| **Scope** | Pagination/sort clamps; protected-field / mass-assignment rejection; ARCH-001 disclosure |
| **Acceptance criteria** | Guards implemented and tested; roadmap and docs state this is architectural preparation with **zero production consumers** |
| **Required evidence** | `repositories/base.py`; `test_tenant_isolation.py`; `test_mass_assignment.py`; ARCH-001 notes in remediation / re-review |
| **Dependencies** | 3.1.2, 3.1.3 |
| **Status** | Complete — verified as **preparation** (not deployed into live business routes) |

**Explicit engineering statements (must remain unchanged):**

- Implemented during Part 3.1.
- This is architectural preparation for future secure data access.
- ARCH-001: **zero production / application callers** of `BaseRepository` today (only tests/helpers instantiate it).
- It is a future security foundation — **do not** imply the layer is fully deployed into product APIs.

**Sub-issues (3)**

| Title | Status |
|---|---|
| Tenant-scoped repository pagination/sort clamps | Complete — verified |
| Mass-assignment / protected-field rejection | Complete — verified |
| Document ARCH-001: zero live `BaseRepository` callers | Complete — verified |

---

### 3.1.11 — Security Regression Suite & CI

| Field | Value |
|---|---|
| **Objective** | Keep Part 3.1 invariants under continuous regression protection. |
| **Scope** | `backend/tests/security/` suite; CI Postgres + Redis pytest/mypy/ruff/alembic checks |
| **Acceptance criteria** | Dedicated security tests present; CI exercises DB + Redis-backed paths |
| **Required evidence** | `backend/tests/security/*`; `.github/workflows/ci.yml`; commit `5f2a66b` |
| **Dependencies** | 3.1.2–3.1.10 |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Assemble `backend/tests/security/` regression suite | Complete — verified |
| CI Postgres + Redis pytest wiring | Complete — verified |

---

### ENGINEERING GOVERNANCE (3.1.12 → 3.1.14)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENGINEERING GOVERNANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1.12  Independent Engineering Review
  ↓
3.1.13  Remediation & Re-verification
  ↓
3.1.14  Deferred Decisions & Production Handoff
```

---

### 3.1.12 — Independent Engineering Review

| Field | Value |
|---|---|
| **Objective** | Independently assess the hardening implementation and inventory findings. |
| **Scope** | Independent Engineering Review report; HIGH/MEDIUM/LOW/INFO inventory |
| **Acceptance criteria** | Review report committed; findings identifiable by ID for remediation tracking |
| **Required evidence** | `Part-03.1-Independent-Engineering-Review.md` |
| **Dependencies** | 3.1.1–3.1.11 implementation artifacts |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Independent engineering review report | Complete — verified |
| Findings inventory (HIGH/MEDIUM/LOW/INFO) | Complete — verified |

---

### 3.1.13 — Remediation & Re-verification

| Field | Value |
|---|---|
| **Objective** | Close in-scope review findings and prove closures with independent re-verification. |
| **Scope** | Required remediation; remediation re-review; NEW-001/002/003 follow-up; final verification |
| **Acceptance criteria** | In-scope HIGH/MEDIUM closures verified; NEW-* VERIFIED; no weakening of controls |
| **Required evidence** | Required Remediation Report; Remediation Re-Review; Minor Follow-Up; Final Follow-Up Verification |
| **Dependencies** | 3.1.12 |
| **Status** | Complete — **VERIFIED** |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Required remediation for SEC-001/003, OBS-001, TEST-001 (+ in-scope MEDIUM) | Complete — verified |
| Independent remediation re-review | Complete — verified |
| Minor follow-up NEW-001 / NEW-002 / NEW-003 | Complete — verified |
| Final follow-up independent verification (**VERIFIED**) | Complete — verified |

---

### 3.1.14 — Deferred Decisions & Production Handoff

| Field | Value |
|---|---|
| **Objective** | Preserve deferred decisions, residual risk, and the production handoff boundary. |
| **Scope** | Deferred P1/P2; RLS decision; VERIFY-001; readiness freeze; Part 3.2 ownership |
| **Acceptance criteria** | Deferred notes exist; NOT READY items remain NOT READY; Part 3.2 named as owner of production verification |
| **Required evidence** | `Deferred-P1-P2-Recommendations.md`; `RLS-Decision-Note.md`; Final Follow-Up VERIFY-001; Re-Review §19–20; Part 3.2 roadmap |
| **Dependencies** | 3.1.13 |
| **Status** | Complete — documented / handoff |

**Sub-issues (5)**

| Title | Status |
|---|---|
| Author Deferred P1/P2 recommendations | Complete — documented |
| Author RLS decision note (deferred P2) | Complete — documented |
| Record residual VERIFY-001 (union-CIDR risk) | Residual — accepted |
| Freeze readiness matrix: Deployment / Production / Traffic **NOT READY** | Complete — documented |
| Explicit handoff: production security verification owned by Part 3.2 | Handoff — Part 3.2 |

---

## 8. Acceptance Criteria

Part 3.1 governing acceptance is met when all of the following are true in repository evidence:

1. Implementation capabilities 3.1.1–3.1.11 exist in code/tests/migrations as cited.
2. Independent review, remediation, and final verification reports exist under `docs/reports/Part-03.1/`.
3. Readiness matrix still records Deployment Configuration / Production Deployment / Production Traffic as **NOT READY** unless superseded by a later Part 3.2 verification report.
4. ARCH-001 remains disclosed: `BaseRepository` has zero live application callers.
5. No governing document claims Part 3.1 production readiness solely because services are online.
6. Production verification ownership is explicitly handed to Part 3.2.

Per-main acceptance criteria are listed under each issue in §7.

---

## 9. Definition of Done

### Local Part 3.1 DoD (met)

1. Hardening implementation committed (`f521d38`).
2. Report pack + CI/env documentation committed (`5f2a66b`).
3. Independent review completed.
4. Required remediation completed and re-reviewed.
5. NEW-001 / NEW-002 / NEW-003 follow-up independently **VERIFIED**.
6. Security regression suite present and CI-wired.

### Production DoD (explicitly not met by Part 3.1)

1. Trusted-proxy values configured and proven for the real edge.
2. Production boot evidence for `validate_production_config()`.
3. Production traffic / auth / rate-limit / header / observability re-verification after Part 3.1.
4. Part 3.2 verification report under `docs/reports/Part-03.2/`.

Until those production items are evidenced by Part 3.2, production readiness remains **NOT CLAIMED**.

---

## 10. Evidence Requirements

Minimum durable evidence pack (already present unless noted):

| Evidence | Path / identity |
|---|---|
| Implementation commit | `f521d38` |
| Reports + CI commit | `5f2a66b` |
| Completion report | `Part-03.1-Backend-Hardening-Completion-Report.md` |
| Independent review | `Part-03.1-Independent-Engineering-Review.md` |
| Remediation report | `Part-03.1-Required-Remediation-Report.md` |
| Re-review | `Part-03.1-Remediation-Re-Review.md` |
| Minor follow-up | `Part-03.1-Minor-Security-Migration-Follow-Up.md` |
| Final verification | `Part-03.1-Final-Follow-Up-Verification.md` |
| Deferred / RLS | `Deferred-P1-P2-Recommendations.md`, `RLS-Decision-Note.md` |
| Security tests | `backend/tests/security/` |
| Production verification (future) | `docs/reports/Part-03.2/` — **not** a Part 3.1 deliverable |

---

## 11. Verification Requirements

The authoritative Part 3.1 verification chain is:

```
Independent Engineering Review
  ↓
Required Remediation
  ↓
Independent Remediation Re-Review
  ↓
Minor Security Migration Follow-Up (NEW-001 / NEW-002 / NEW-003)
  ↓
Final Follow-Up Independent Verification → VERIFIED
```

Verification rules:

1. Closures must be re-derivable from code and tests, not only from report prose.
2. Local suite cleanliness does not imply production verification.
3. Residuals (VERIFY-001; Deferred §1 production DB posture) must remain visible until closed or explicitly risk-accepted by a later stage.
4. Any future claim that Deployment / Production / Traffic are READY must cite a Part 3.2 verification report that supersedes the Part 3.1 readiness matrix.

---

## 12. Engineering Review Traceability

| Finding ID | Severity (as reviewed) | Closure / state | Primary evidence |
|---|---|---|---|
| SEC-001 | HIGH | CLOSED / VERIFIED | `client_ip.py`; trusted-proxy tests; remediation + re-review |
| SEC-003 | MEDIUM | CLOSED / VERIFIED | HSTS/scheme via `resolve_client_identity()` |
| OBS-001 | HIGH | CLOSED / VERIFIED | Production exception logging path + `test_exception_logging.py` |
| TEST-001 | HIGH | CLOSED / VERIFIED | Dedicated security/integration coverage added in remediation |
| SEC-002 | MEDIUM | CLOSED / VERIFIED (determinism only) | `User.roles` ordering + authorization test |
| ARCH-001 | MEDIUM | PARTIALLY CLOSED by design | Docs corrected; zero live `BaseRepository` callers unchanged |
| TEST-002 / TEST-003 | MEDIUM | Satisfied by SEC-001/SEC-003 HTTP tests | Remediation report |
| NEW-001 | LOW | CLOSED / VERIFIED | `/0` rejection in Settings validator |
| NEW-002 | LOW | CLOSED / VERIFIED | `test_trusted_proxy_config.py` (mutation-tested) |
| NEW-003 | INFO | CLOSED / VERIFIED | Local Alembic/DB head accuracy follow-up |
| VERIFY-001 | LOW residual | Open / accepted residual | Final Follow-Up § New Findings — union of non-`/0` CIDRs |

---

## 13. Deferred / Future Work

| Item | Classification | Owner |
|---|---|---|
| Real `TRUSTED_PROXY_*` values for Railway/edge | Deployment configuration | **Part 3.2** |
| Production boot / traffic / auth re-verification | Production verification | **Part 3.2** |
| DB least-privilege roles, TLS, backups (Deferred §1) | Required before go-live | **Part 3.2** (config/ops) |
| VERIFY-001 union-CIDR residual | Optional hardening or documented acceptance | Future / Part 3.2 docs |
| PostgreSQL RLS | Deferred P2 | Future (see `RLS-Decision-Note.md`) |
| Uploads / workers / outbox / idempotency / optimistic concurrency | Deferred until feature trigger | Future feature work |
| Live business CRUD on `BaseRepository` | Future adoption of prepared foundation | Future module work |
| Existing Linear WAL-18 / WAL-28 production-framing corrections | Description hygiene | Separate approval only |

---

## 14. Traceability Matrix

| Hierarchy ID | Capability / phase | Key files | Tests / reports | Historical Linear (WAL-18–28) |
|---|---|---|---|---|
| 3.1 | Umbrella | `docs/reports/Part-03.1/` | Final verification + re-review readiness | WAL-18 |
| 3.1.1 | Requirements / threat review | Completion report | `Part-03.1-Backend-Hardening-Completion-Report.md` | WAL-19 |
| 3.1.2 | Schema integrity | models + Alembic `217e90d00cc0` / `3a2aec52f6d2` | `backend/tests/security/test_cross_tenant_relationships.py` | No dedicated WAL — under WAL-18 evidence |
| 3.1.3 | Authz / session | `backend/app/dependencies/auth.py`, `backend/app/models/user.py`, `backend/app/services/auth_service.py` | `backend/tests/security/test_authorization.py`, `backend/tests/security/test_session_security.py` | No dedicated WAL — under WAL-18 evidence |
| 3.1.4 | Request context | `backend/app/middleware/request_context.py`, `backend/app/main.py` | `backend/tests/security/test_request_context.py` | WAL-20 |
| 3.1.5 | Trusted proxy / IP | `backend/app/core/client_ip.py`, `backend/app/core/config.py` | `backend/tests/security/test_client_ip.py`, `backend/tests/security/test_trusted_proxy_*` | WAL-21 |
| 3.1.6 | Rate limiting | `backend/app/core/rate_limit.py`, `backend/app/api/v1/auth.py` | `backend/tests/security/test_rate_limiting.py` | WAL-22 |
| 3.1.7 | Headers / CORS | `backend/app/middleware/security_headers.py`, `backend/app/main.py` | security HTTP coverage + `backend/tests/test_config.py` | WAL-23 |
| 3.1.8 | Audit / redaction / OBS | `backend/app/services/audit_service.py`, `backend/app/core/redaction.py`, logging/exception path | `backend/tests/security/test_audit_logging.py`, `backend/tests/security/test_exception_logging.py`, `backend/tests/security/test_sensitive_data_exposure.py` | WAL-24 |
| 3.1.9 | Prod config validation | `backend/app/core/config.py`, `backend/app/main.py` | `backend/tests/test_config.py`, `backend/tests/security/test_trusted_proxy_config.py` | No dedicated WAL — under WAL-18 / WAL-21 evidence |
| 3.1.10 | Repository security foundation | `backend/app/repositories/base.py` | `backend/tests/test_tenant_isolation.py`, `backend/tests/security/test_mass_assignment.py`; ARCH-001 | No dedicated WAL — under WAL-18 evidence |
| 3.1.11 | Regression suite & CI | `backend/tests/security/*`, `.github/workflows/ci.yml` | suite + CI | WAL-25 |
| 3.1.12 | Independent review | review report | `Part-03.1-Independent-Engineering-Review.md` | WAL-26 |
| 3.1.13 | Remediation & re-verification | remediation + follow-up reports | Re-Review + Final Verification | WAL-27 |
| 3.1.14 | Deferred + handoff | Deferred/RLS notes; Part 3.2 roadmap | Re-Review §19–20; VERIFY-001 | WAL-28 (historical label only; production verification owned by Part 3.2) |

Title-accurate WAL → governance mapping is authoritative in Appendix C. The governing hierarchy remains 3.1 / 3.1.x / sub-issues in this document.

---

## Appendix A — Linear mutation policy (reference)

WAL-18 through WAL-28 are **historical** Linear records. They must not be expanded into a retrospective 64-issue tree.

Description corrections for inaccurate production claims on WAL-18 / WAL-28 (see Part 3.2 Appendix A) require separate approval. This roadmap does not authorize those mutations.

---

## Appendix B — Consistency checklist (author validation)

| Check | Result |
|---|---|
| Hierarchy matches approved discovery proposal | Yes — 1 + 14 + 49 = 64 |
| Implementation vs governance visually separated | Yes — §6 / §7 banners; 3.1.1–3.1.11 vs 3.1.12–3.1.14 |
| 3.1.10 reframed as Repository Security Foundation | Yes — preparation + ARCH-001 zero consumers |
| Current Engineering Status present after Scope | Yes — §3 |
| Local COMPLETE / review COMPLETE / remediation COMPLETE / verification VERIFIED preserved | Yes |
| Deployment / Production / Traffic NOT READY preserved | Yes — §3, §9, §13, 3.1.14 |
| Online ≠ production verified preserved | Yes — header hard rules + §3 |
| No unsupported production-readiness claim | Yes — Production Readiness **NOT CLAIMED** |
| Paths cited exist under app root | Yes — revalidated 2026-07-19 |
| Alembic revision IDs distinguished from git commits | Yes — §4 |
| WAL-18–WAL-28 title mapping matches Appendix C | Yes |
| No retrospective 64-issue Linear expansion | Yes — closed by product decision |
| Proposal A/B not used | Yes |
| Product README indexes this roadmap | Yes — `docs/product/README.md` |
| Linear mutations in this closeout | None |

---

## Appendix C — Existing Linear Traceability

WAL-18–WAL-28 remain the **historical execution record** for Part 3.1 in Linear.

This governance roadmap is the **canonical engineering decomposition**. It intentionally provides finer granularity than the original Linear A–J execution slices so repository capabilities, review lifecycle, and deferred handoff are auditable without rewriting project history.

**No retrospective Linear expansion was performed.** Creating another 64-issue tree would duplicate repository information without adding operational value. Part 3.2 retains a detailed Linear hierarchy because it tracks future execution work; Part 3.1 does not.

### Mapping rules

1. Map only by **Linear issue title** ↔ **governance section title / role**.
2. Where the roadmap is finer than Linear, note “no dedicated WAL” rather than inventing a parent assignment beyond WAL-18 umbrella evidence.
3. WAL-28’s historical title (“Production Verification & Documentation”) must **not** be read as repository proof that production security is verified — readiness remains **NOT READY** / deferred to Part 3.2 per §3 and `Part-03.1-Remediation-Re-Review.md` §19.

### Existing Linear Issue → Governance Sections

| Existing Linear Issue | Linear title (historical) | Governance sections |
|---|---|---|
| **WAL-18** | 03.1 — Backend Security Hardening | **3.1** umbrella (overall Part 3.1) |
| **WAL-19** | 03.1-A — Security Requirements & Threat Review | **3.1.1** |
| **WAL-20** | 03.1-B — Request Context & Request-ID Hardening | **3.1.4** |
| **WAL-21** | 03.1-C — Trusted Proxy & Client IP Boundary | **3.1.5** |
| **WAL-22** | 03.1-D — Redis Rate Limiting | **3.1.6** |
| **WAL-23** | 03.1-E — Security Headers & CORS Boundary | **3.1.7** |
| **WAL-24** | 03.1-F — Audit Logging & Exception Observability | **3.1.8** |
| **WAL-25** | 03.1-G — Security Regression Testing | **3.1.11** |
| **WAL-26** | 03.1-H — Independent Engineering Review | **3.1.12** |
| **WAL-27** | 03.1-I — Remediation & Re-verification | **3.1.13** |
| **WAL-28** | 03.1-J — Production Verification & Documentation | Historical closeout label only → **3.1.14** handoff / deferred documentation; **production verification owned by Part 3.2** |

### Governance sections without a dedicated Linear issue

These exist only in the canonical roadmap (finer decomposition). Evidence lives under WAL-18 (and related reports/commits), not as separate WAL children:

| Governance section | Note |
|---|---|
| **3.1.2** Schema & Cross-Tenant Integrity Hardening | No dedicated WAL |
| **3.1.3** Authorization & Session Hardening | No dedicated WAL |
| **3.1.9** Production Configuration Validation | No dedicated WAL (related evidence also appears under WAL-21 trusted-proxy config work) |
| **3.1.10** Repository Security Foundation | No dedicated WAL (ARCH-001 preparation) |

---

## Document control

| Field | Value |
|---|---|
| **Status** | **CANONICAL** — Repository-authorized · Retrospective Governance · **CLOSED** |
| Created | 2026-07-19 |
| Finalized / closed | 2026-07-19 |
| Location | `docs/product/Part-03.1-Backend-Security-Hardening-Governance-Roadmap.md` |
| Product index | `docs/product/README.md` |
| Nature | Retrospective governing reconstruction |
| Decomposition count (documentation only) | 1 umbrella + 14 mains + 49 sub-issues = **64** (not materialized in Linear) |
| Historical Linear record | WAL-18–WAL-28 (Appendix C) |
| Downstream | Part 3.2 owns Deployment Configuration / Production Deployment / Production Traffic verification |
| Retrospective Linear expansion | **Not performed — permanently declined** |
| Next action | Freeze Part 3.1; execute Part 3.2 (external security layer / Cloudflare primary, provider-agnostic architecture) |
