# Part 2 — Authentication

**Project:** NexusOS — AI Business Operating System  
**Status:** Governing engineering roadmap (retrospective reconstruction; Linear hierarchy pending approval)  
**Audience:** Engineers governing Part 2 authentication evidence, Linear hierarchy design, and handoff into later security / deployment parts  
**Builds on:**

- Part 1 — Foundation (`docs/reports/Part-01/`)
- Part 3 — Database architecture (`docs/product/database.md`) — shared schema foundation

**Authority:** Repository product documentation under `docs/product/`.  
Archive roadmaps under `docs/archive/` remain non-governing.  
This document is a **retrospective engineering reconstruction**. The repository is the only source of truth.  
Rejected chat proposals (Proposal A / Proposal B) must not be used to create Linear issues.

**Hard rules:**

- Do **not** invent engineering work not supported by code, tests, reports, or git history.
- Do **not** rewrite historical Linear implementation history.
- Do **not** treat documentation omissions as automatic engineering work packages.
- Part 2-era production smoke (completion report) is **not** a substitute for post–Part 3.1 authentication re-verification (owned by Part 3.2).

**Evidence baseline commits:** `9ff16e5` (Part 02 authentication milestone), `6476382` (Sentry — deployment-era adjacency), `309466b` (completion report). Supporting deploy fixes evidenced in history include `68f2301`, `205fb2d`, and related auth/schema follow-ups.

**Linear note:**

- **WAL-6** (`02 — Authentication (UX Layer)`) remains the **historical execution umbrella** for Part 2.
- The hierarchy in this roadmap is the **canonical engineering decomposition**.
- Finer granularity than WAL-6 is intentional.
- No historical implementation history is rewritten.
- When Linear sync is approved, new issues attach **beneath WAL-6** (children / grandchildren). WAL-6 is **not** superseded, replaced, or archived by this document.

---

## 1. Purpose

Record, govern, and make auditable the Part 2 Authentication work that was already implemented in the repository, and define the canonical engineering hierarchy for Linear.

This roadmap exists so that:

1. Implemented authentication capabilities are grouped into a durable hierarchy derived from repository evidence.
2. Frontend and backend auth surfaces are governed together without inventing product features.
3. Deferred gaps (real email delivery, MFA/OAuth) remain explicit.
4. Authentication production validation is separated from general deployment engineering.
5. WAL-6 remains the historical record while the new tree provides reviewable engineering granularity.

Part 2 governance is a **retrospective reconstruction**, not a forward feature plan.

---

## 2. Scope

### In scope (evidenced in repository)

1. Authentication requirements and access/refresh/opaque-token architecture.
2. Auth-related data model and Alembic migrations (`sessions`, `auth_tokens`, user/company auth fields).
3. Password hashing (Argon2) and JWT cryptography.
4. Registration with company bootstrap and Owner role seeding.
5. Login and authenticated identity (`GET /me`, permissions flatten).
6. Refresh-token session lifecycle (rotation, reuse detection, expiry).
7. Logout and session revocation.
8. Forgot-password, reset-password, and email-verification flows (including log-only email seam).
9. Auth HTTP API surface and request/response contracts.
10. Frontend auth UX, token store, refresh interceptor, and protected routes.
11. Auth regression tests (backend service/API + frontend auth tests).
12. Authentication production validation evidence (smoke / endpoints / migrations / FE auth / evidence pack).
13. Engineering completion documentation.
14. Deferred capabilities and downstream handoff (real email, MFA/OAuth, Part 3.2 re-smoke).

### Explicit non-goals

- Creating Railway / Vercel / Sentry / DNS infrastructure work packages under Part 2 auth parents.
- Implementing real transactional email, MFA, OAuth, or SSO in this governance phase.
- Rewriting or archiving WAL-6.
- Claiming post–Part 3.1 production security verification (Part 3.2).
- Building CRM/HR/Finance business modules.
- Treating repository documentation observations as mandatory engineering issues.

---

## 3. Current Engineering Status

| Area | Status |
|---|---|
| Implementation (code + tests + migrations) | ✔ **COMPLETE** |
| Part 2 completion report | ✔ **COMPLETE** |
| Independent engineering review pack (Part 2-specific) | ✘ **Not performed** |
| Authentication production validation (Part 2-era report) | ✔ **Evidenced** in completion report |
| Post–Part 3.1 authentication re-verification | ✘ **Owned by Part 3.2** |
| Real email delivery | ✘ **Deferred** (log-only stub) |
| MFA / OAuth / SSO | ✘ **Not implemented** |
| Canonical Linear decomposition under WAL-6 | ✘ **Pending creation approval** |

**Summary:** Part 2 authentication is implemented and was reported complete with Part 2-era production smoke. There is no Part 2 independent review/remediation pack. Post–3.1 auth re-verification and deployment topology work belong elsewhere (Part 3.2). Real email delivery remains intentionally unfinished.

---

## 4. Repository Sources

| Source class | Location / identity |
|---|---|
| Implementation commits | `9ff16e5`, supporting auth/deploy commits as cited in § evidence |
| Completion report | `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md` |
| Auth API | `backend/app/api/v1/auth.py` |
| Auth service | `backend/app/services/auth_service.py` |
| Auth dependencies | `backend/app/dependencies/auth.py` |
| Security utilities | `backend/app/core/security.py` |
| Auth schemas | `backend/app/schemas/auth.py` |
| Auth models | `backend/app/models/auth.py`, `user.py`, `company.py`, `enums.py` |
| Email seam | `backend/app/services/email_service.py` |
| Migrations | `20260709_0a961c2ea2cf_initial_schema.py`, `20260714_382d8497298e_add_sessions_and_auth_tokens_tables.py` |
| Backend tests | `backend/tests/test_auth_service.py`, `backend/tests/test_auth_api.py` |
| Frontend auth | `frontend/src/pages/auth/*`, `frontend/src/features/auth/*`, `frontend/src/stores/auth.ts`, `frontend/src/api/client.ts`, `frontend/src/routes/ProtectedRoute.tsx` |
| Frontend tests | `frontend/src/features/auth/tests/*`, `frontend/src/pages/auth/__tests__/*` |
| Historical Linear umbrella | **WAL-6** — `02 — Authentication (UX Layer)` (Done; no prior children) |
| Downstream auth re-smoke | Part 3.2 roadmap / Linear family (post–3.1), not Part 2 parents |

---

## 5. Engineering Summary

Part 2 delivered a complete authentication UX layer:

- Multi-tenant registration (company + Owner bootstrap).
- Login, logout, refresh rotation with server-side `Session` rows and reuse compromise handling.
- `/me` identity with flattened permissions.
- Forgot/reset/verify flows backed by `auth_tokens` and a replaceable `EmailService` seam that currently logs links.
- Frontend pages, persisted tokens, refresh interceptor, and route protection.
- Service/API/frontend tests and a Part 2 completion report claiming Part 2-era production smoke.

What Part 2 did **not** deliver as product-complete email or advanced auth:

- Real provider-backed transactional email.
- MFA / OAuth / SSO.
- A Part 2-specific independent engineering review package.

---

## 6. Canonical Work Breakdown

Work groups below are derived from repository evidence, then split into:

1. **Implementation capabilities** (2.1–2.11)
2. **Engineering governance lifecycle** (2.12–2.14)

### IMPLEMENTATION

| Group | Capability | Primary evidence |
|---|---|---|
| 2.1 | Requirements & architecture | Completion report + token/session design in code |
| 2.2 | Auth data model & migrations | Models + Alembic `0a961c2ea2cf`, `382d8497298e` |
| 2.3 | Password hashing & JWT cryptography | `security.py` |
| 2.4 | Registration & multi-tenant bootstrap | `auth_service.register`, RegisterPage |
| 2.5 | Login & authenticated identity | `login`, `get_me`, LoginPage |
| 2.6 | Refresh session lifecycle | `refresh`, `Session`, session security tests |
| 2.7 | Logout & revocation | `logout`, frontend logout |
| 2.8 | Password reset & email verification | forgot/reset/verify + `EmailService` |
| 2.9 | Auth HTTP API & contracts | `auth.py`, `schemas/auth.py` |
| 2.10 | Frontend auth UX, store & client | pages, store, interceptor, guards |
| 2.11 | Auth regression test suite | backend + frontend auth tests |

### ENGINEERING GOVERNANCE

| Group | Lifecycle phase | Primary evidence |
|---|---|---|
| 2.12 | Authentication production validation | Part 2 completion report auth smoke / validation narrative |
| 2.13 | Engineering completion documentation | Part 2 completion report |
| 2.14 | Deferred capabilities & downstream handoff | `email_service.py`; schema flags; Part 3.2 re-smoke ownership |

---

## 7. Hierarchical Issue Structure

**Do not create these Linear issues until separately approved.**  
When approved, create them **under WAL-6**. Do not alter WAL-6’s historical role.

### Count summary (authoritative)

| Layer | Count |
|---|---|
| Umbrella issue (canonical decomposition root under WAL-6) | **1** |
| Main issues | **14** |
| Sub-issues | **49** |
| **Total new Linear issues (proposed)** | **64** |

These counts were derived from repository evidence grouping. They must not be optimized for symmetry.

**Relationship to WAL-6**

| Object | Role |
|---|---|
| WAL-6 | Historical Part 2 execution umbrella — **retain** |
| `2 — Authentication` (this hierarchy’s umbrella) | Canonical engineering decomposition root; Linear parent = WAL-6 |
| 2.1–2.14 | Main engineering issues |
| Sub-issues | Meaningful work packages only |

### Status vocabulary (retrospective)

| Status in this doc | Meaning |
|---|---|
| Complete — verified | Implemented and covered by Part 2 tests / report evidence |
| Complete — documented | Intentionally recorded; may be incomplete as a product feature |
| Deferred | Explicitly not implemented; future trigger required |
| Handoff — Part 3.2 | Authentication re-verification after Part 3.1 owned elsewhere |

---

### 2 — Umbrella

| Field | Value |
|---|---|
| **Title** | 2 — Authentication |
| **Linear parent** | **WAL-6** (historical umbrella; not replaced) |
| **Objective** | Govern the completed Part 2 authentication stack as a repository-authorized engineering decomposition. |
| **Scope** | §§2–15 of this document |
| **Acceptance criteria** | Definition of Done §9 |
| **Required evidence** | Part 2 completion report + commits `9ff16e5` / `309466b` (+ supporting history) |
| **Dependencies** | Part 1 foundation; Part 3 schema tables used at registration |
| **Suggested labels** | `backend`, `frontend`, `security`, `Testing&Verification` |
| **Status** | Implementation **COMPLETE**; canonical Linear tree **pending creation** |

---

### IMPLEMENTATION (2.1 → 2.11)

```
2.1  Authentication Requirements & Architecture
  ↓
2.2  Auth Data Model & Migrations
  ↓
2.3  Password Hashing & JWT Cryptography
  ↓
2.4  Registration & Multi-Tenant Bootstrap
  ↓
2.5  Login & Authenticated Identity
  ↓
2.6  Refresh Token Session Lifecycle
  ↓
2.7  Logout & Session Revocation
  ↓
2.8  Password Reset & Email Verification
  ↓
2.9  Auth HTTP API & Contracts
  ↓
2.10 Frontend Auth UX, Store & Client
  ↓
2.11 Auth Regression Test Suite
```

---

### 2.1 — Authentication Requirements & Architecture

| Field | Value |
|---|---|
| **Objective** | Capture Part 2 auth requirements and the access/refresh/opaque-token architecture. |
| **Acceptance criteria** | Requirements and architecture choices are traceable to implemented code |
| **Required evidence** | Completion report; `security.py`; `auth_service.py` |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Capture Part 2 authentication requirements | Complete — verified |
| Record access / refresh / opaque-token architecture | Complete — verified |

---

### 2.2 — Auth Data Model & Migrations

| Field | Value |
|---|---|
| **Objective** | Persist users/companies auth fields and dedicated session/token tables. |
| **Acceptance criteria** | Migrations create required auth tables/columns; models match |
| **Required evidence** | `0a961c2ea2cf`, `382d8497298e`; `models/auth.py`, `user.py`, `company.py` |
| **Status** | Complete — verified |

**Sub-issues (3)**

| Title | Status |
|---|---|
| User / company authentication fields | Complete — verified |
| `sessions` table migration | Complete — verified |
| `auth_tokens` table migration | Complete — verified |

---

### 2.3 — Password Hashing & JWT Cryptography

| Field | Value |
|---|---|
| **Objective** | Provide credential hashing and JWT/opaque token primitives. |
| **Acceptance criteria** | Argon2 hashing; access/refresh JWT helpers; opaque token hash helpers |
| **Required evidence** | `backend/app/core/security.py` |
| **Status** | Complete — verified |

**Sub-issues (3)**

| Title | Status |
|---|---|
| Argon2 password hashing | Complete — verified |
| Access JWT issue / decode | Complete — verified |
| Refresh JWT + opaque token helpers | Complete — verified |

---

### 2.4 — Registration & Multi-Tenant Bootstrap

| Field | Value |
|---|---|
| **Objective** | Register a user with a new company and Owner role bootstrap. |
| **Acceptance criteria** | Company+user+session issued; FE register works; tests cover happy/error paths |
| **Required evidence** | `auth_service.register`; `POST /auth/register`; RegisterPage; auth tests |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Company + slug bootstrap | Complete — verified |
| System role seeding (`DEFAULT_ROLES`) | Complete — verified |
| Register service + `POST /register` | Complete — verified |
| Register frontend + tests | Complete — verified |

---

### 2.5 — Login & Authenticated Identity

| Field | Value |
|---|---|
| **Objective** | Authenticate credentials and expose current-user identity/permissions. |
| **Acceptance criteria** | Login issues tokens; `/me` returns user+permissions; FE login works |
| **Required evidence** | `login`, `get_me`; `GET /auth/me`; LoginPage; API tests |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Login service | Complete — verified |
| `GET /me` + permission flatten | Complete — verified |
| Login frontend | Complete — verified |
| Login / me API tests | Complete — verified |

---

### 2.6 — Refresh Token Session Lifecycle

| Field | Value |
|---|---|
| **Objective** | Rotate refresh sessions safely and fail closed on reuse/expiry. |
| **Acceptance criteria** | Rotation works; reuse revokes family; expired session cannot refresh |
| **Required evidence** | `auth_service.refresh`; `Session`; `test_auth_service` + session security tests |
| **Status** | Complete — verified |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Session issue on authentication | Complete — verified |
| Refresh token rotation | Complete — verified |
| Refresh-reuse compromise detection | Complete — verified |
| Session expiry regression tests | Complete — verified |

---

### 2.7 — Logout & Session Revocation

| Field | Value |
|---|---|
| **Objective** | Revoke the refresh session on logout (idempotent). |
| **Acceptance criteria** | Logout revokes jti; FE clears local auth state |
| **Required evidence** | `auth_service.logout`; `useLogout` / auth store |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Logout revoke-by-jti | Complete — verified |
| Frontend logout wiring | Complete — verified |

---

### 2.8 — Password Reset & Email Verification

| Field | Value |
|---|---|
| **Objective** | Provide forgot/reset/verify token flows with a replaceable email seam. |
| **Acceptance criteria** | Token flows work; email seam logs links (no provider required for Part 2 close) |
| **Required evidence** | forgot/reset/verify routes; `AuthToken`; `email_service.py`; FE pages |
| **Status** | Complete — verified (email delivery deferred) |

**Sub-issues (5)**

| Title | Status |
|---|---|
| Forgot-password flow | Complete — verified |
| Reset-password flow | Complete — verified |
| Verify-email flow | Complete — verified |
| Log-only `EmailService` seam | Complete — documented |
| Frontend recovery / verify pages | Complete — verified |

---

### 2.9 — Auth HTTP API & Contracts

| Field | Value |
|---|---|
| **Objective** | Expose a consistent `/api/v1/auth` contract for the UX layer. |
| **Acceptance criteria** | All eight auth routes exist; schemas enforce contracts |
| **Required evidence** | `api/v1/auth.py`; `schemas/auth.py` |
| **Status** | Complete — verified |

**Sub-issues (3)**

| Title | Status |
|---|---|
| Route surface under `/api/v1/auth` | Complete — verified |
| Request / response contracts (Pydantic) | Complete — verified |
| Response envelope consistency | Complete — verified |

---

### 2.10 — Frontend Auth UX, Store & Client

| Field | Value |
|---|---|
| **Objective** | Deliver auth UX with persisted tokens and silent refresh. |
| **Acceptance criteria** | Pages/routes work; store persists; interceptor refreshes; guard protects routes |
| **Required evidence** | auth pages; `stores/auth.ts`; `api/client.ts`; `ProtectedRoute` |
| **Status** | Complete — verified |

**Sub-issues (5)**

| Title | Status |
|---|---|
| Auth routes and layout | Complete — verified |
| Zustand token persistence | Complete — verified |
| Axios refresh interceptor | Complete — verified |
| `ProtectedRoute` guard | Complete — verified |
| Auth page test suite | Complete — verified |

---

### 2.11 — Auth Regression Test Suite

| Field | Value |
|---|---|
| **Objective** | Keep Part 2 auth invariants under automated regression. |
| **Acceptance criteria** | Service, API, and frontend auth tests exist for core flows |
| **Required evidence** | `test_auth_service.py`; `test_auth_api.py`; FE auth tests |
| **Status** | Complete — verified |

**Sub-issues (3)**

| Title | Status |
|---|---|
| `test_auth_service` suite | Complete — verified |
| `test_auth_api` suite | Complete — verified |
| Frontend auth service / schema tests | Complete — verified |

---

### ENGINEERING GOVERNANCE (2.12 → 2.14)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENGINEERING GOVERNANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.12  Authentication Production Validation
  ↓
2.13  Engineering Completion Documentation
  ↓
2.14  Deferred Capabilities & Downstream Handoff
```

---

### 2.12 — Authentication Production Validation

| Field | Value |
|---|---|
| **Objective** | Record Part 2-era **authentication** validation evidence only (not general infrastructure engineering). |
| **Scope** | Auth smoke, auth endpoints, auth migrations, frontend auth validation, auth evidence pack |
| **Out of scope** | Railway/Vercel deployment engineering, Sentry integration work, general infrastructure configuration (deployment engineering / Part 3.2) |
| **Acceptance criteria** | Completion report’s authentication validation claims are traceable; gaps for post–3.1 re-smoke are handed to Part 3.2 |
| **Required evidence** | Part 2 completion report authentication sections |
| **Status** | Complete — verified (Part 2-era); superseding post–3.1 proof → Part 3.2 |

**Sub-issues (5)**

| Title | Status |
|---|---|
| Production authentication smoke tests | Complete — verified (Part 2-era report) |
| Authentication endpoint validation | Complete — verified (Part 2-era report) |
| Authentication migration validation | Complete — verified (Part 2-era report) |
| Frontend authentication validation | Complete — verified (Part 2-era report) |
| Production authentication evidence pack | Complete — verified (completion report) |

---

### 2.13 — Engineering Completion Documentation

| Field | Value |
|---|---|
| **Objective** | Preserve the Part 2 engineering completion record in-repo. |
| **Acceptance criteria** | Completion report committed with evidence references |
| **Required evidence** | `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md`; commit `309466b` |
| **Status** | Complete — verified |

**Sub-issues (2)**

| Title | Status |
|---|---|
| Author Part 2 authentication completion report | Complete — verified |
| Preserve completion evidence paths and commit references | Complete — verified |

---

### 2.14 — Deferred Capabilities & Downstream Handoff

| Field | Value |
|---|---|
| **Objective** | Keep unfinished or out-of-scope auth capabilities explicit without inventing work. |
| **Acceptance criteria** | Deferred items and Part 3.2 handoff are documented |
| **Required evidence** | `email_service.py`; `User.two_factor_enabled`; Part 3.2 auth re-smoke ownership |
| **Status** | Deferred / handoff |

**Sub-issues (4)**

| Title | Status |
|---|---|
| Real transactional email provider follow-up | Deferred |
| MFA / OAuth / SSO out of Part 2 scope | Deferred |
| Session IP/UA persistence residual (columns unused at issue time) | Residual — accepted |
| Post–Part 3.1 authentication re-smoke owned by Part 3.2 | Handoff — Part 3.2 |

---

## 8. Acceptance Criteria

Part 2 governing acceptance is met when all are true:

1. Implementation capabilities 2.1–2.11 exist in code/tests/migrations as cited.
2. Authentication production validation (2.12) is evidenced by the Part 2 completion report for Part 2-era smoke.
3. Completion documentation (2.13) exists under `docs/reports/Part-02/`.
4. Deferred/handoff items (2.14) remain explicit.
5. WAL-6 remains the historical umbrella; the new tree is the canonical decomposition under it.
6. No Part 2 parent claims ownership of general Railway/Vercel/Sentry infrastructure engineering.

Per-main acceptance criteria are listed under each issue in §7.

---

## 9. Definition of Done

### Local / repository Part 2 DoD (met)

1. Auth implementation committed (`9ff16e5` and supporting history).
2. Auth tests present for core service/API/FE flows.
3. Completion report committed (`309466b`).
4. Canonical governance roadmap authored (this document).

### Canonical Linear DoD (pending approval)

1. 64 issues created under WAL-6 per §7.
2. Titles/parents/traceability match this roadmap.
3. WAL-6 not archived or retitled away from its historical role.

### Not claimed by Part 2 DoD

1. Real email delivery.
2. MFA / OAuth / SSO.
3. Post–Part 3.1 production authentication re-verification (Part 3.2).
4. Independent Part 2 review/remediation package (was not produced).

---

## 10. Verification Requirements

| Verification lens | Requirement |
|---|---|
| Local suite | Auth service/API/FE tests remain green for Part 2 surfaces |
| Part 2-era production | Completion report authentication validation stands as historical evidence |
| Post–3.1 production | Must be re-proven under Part 3.2 — do not inherit Part 2 smoke as current security proof |
| Email delivery | Not verified (stub by design) |
| Independent review | No Part 2 review pack to re-verify |

---

## 11. Evidence Requirements

| Evidence | Path / identity |
|---|---|
| Completion report | `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md` |
| Primary implementation commit | `9ff16e5` |
| Report commit | `309466b` |
| Auth routes / service / security | `backend/app/api/v1/auth.py`, `services/auth_service.py`, `core/security.py` |
| Migrations | `0a961c2ea2cf`, `382d8497298e` |
| Frontend auth | `frontend/src/pages/auth/*`, `stores/auth.ts`, `api/client.ts` |
| Tests | `backend/tests/test_auth_*.py`, frontend auth tests |
| Historical Linear | WAL-6 |

---

## 12. Engineering Review Traceability

| Item | State | Notes |
|---|---|---|
| Part 2 independent engineering review report | **Not present** | Unlike Part 3.1; do not invent findings |
| Part 2 remediation / re-review / final verification pack | **Not present** | N/A |
| Part 2 completion report | Present | Primary closeout artifact |
| Later overlays (rate limits, trusted proxy, authz fail-closed) | Part 3.1 | Not attributed to original Part 2 implementation parents |

---

## 13. Validation Summary

| Lens | Verdict |
|---|---|
| Local engineering | Auth stack implemented and tested |
| Part 2 official report | COMPLETE (Part 2-era production authentication smoke claimed) |
| Canonical Linear decomposition | Proposed here; not yet created |
| Product-complete email | Not delivered (log-only seam) |
| Advanced auth (MFA/OAuth/SSO) | Not delivered |
| Current post–3.1 production auth proof | Not owned by Part 2 — Part 3.2 |

---

## 14. Deferred / Future Work

| Item | Classification | Owner |
|---|---|---|
| Real email provider (Resend/SMTP) behind `EmailService` | Deferred feature | Future auth/ops work |
| MFA / passkeys / OAuth / SSO | Out of Part 2 scope | Future auth work |
| Session `ip_address` / `user_agent` persistence at issue time | Residual | Optional future hardening |
| Post–Part 3.1 auth production re-smoke | Required later | **Part 3.2** |
| Independent Part 2 review package | Not produced historically | Do not fabricate |

---

## 15. Traceability Matrix

| Hierarchy ID | Capability / phase | Key files | Tests / reports | Linear |
|---|---|---|---|---|
| 2 | Umbrella | Part-02 report pack | Completion report | Child of **WAL-6** |
| 2.1 | Requirements / architecture | report + `security.py` / service | Completion report | under 2 |
| 2.2 | Data model / migrations | models + Alembic auth revisions | migration presence | under 2 |
| 2.3 | Crypto | `core/security.py` | auth service tests | under 2 |
| 2.4 | Registration | `auth_service.register`, RegisterPage | auth tests | under 2 |
| 2.5 | Login / me | login, `get_me`, LoginPage | auth API tests | under 2 |
| 2.6 | Refresh lifecycle | `refresh`, `Session` | service + session tests | under 2 |
| 2.7 | Logout | `logout`, FE logout | auth tests | under 2 |
| 2.8 | Reset / verify | forgot/reset/verify + `email_service` | auth tests + FE pages | under 2 |
| 2.9 | HTTP contracts | `api/v1/auth.py`, schemas | API tests | under 2 |
| 2.10 | Frontend client | pages, store, interceptor, guard | FE auth tests | under 2 |
| 2.11 | Regression suite | `test_auth_*`, FE tests | suites | under 2 |
| 2.12 | Auth production validation | completion report auth sections | Part 2-era evidence | under 2 |
| 2.13 | Completion docs | Part-02 report | `309466b` | under 2 |
| 2.14 | Deferred / handoff | email stub; Part 3.2 | deferred notes | under 2 |

---

## Appendix A — WAL-6 historical relationship

| Field | Value |
|---|---|
| Issue | **WAL-6** — `02 — Authentication (UX Layer)` |
| Role | Historical Part 2 execution umbrella |
| Children before this roadmap | None |
| Action authorized by this roadmap | **Retain**. Do not supersede, replace, or archive. |
| Future Linear action (pending approval) | Attach the §7 hierarchy beneath WAL-6 |

---

## Appendix B — Repository Observations

These are **observations**, not automatic engineering issues. Documentation gaps do not create work packages unless repository evidence shows required engineering.

| Observation | Classification |
|---|---|
| Completion report §2 / DoD omits forgot/reset/verify pages even though code/FE/tests implement them | Documentation observation |
| `email_service.py` references a “Part 02 implementation report” that does not exist in `docs/reports/Part-02/` | Documentation observation |
| Email provider intentionally remains a log-only stub (`EmailService`) | Intentional deferred design |
| Residual debug `console.log` statements in `frontend/src/api/client.ts` | Optional cleanup; not elevated to Part 2 hierarchy without a separate decision |
| Auth route rate limits and some authz fail-closed tests are Part 3.1 overlays | Not attributable to original Part 2 parents |
| No independent Part 2 review / remediation / re-verification package | Historical fact — do not invent findings |
| Part 2 production COMPLETE claims are Part 2-era; Part 3.2 still requires post–3.1 auth re-smoke | Ownership boundary |

---

## Appendix C — Consistency checklist (author validation)

| Check | Result |
|---|---|
| Hierarchy matches approved proposal + revisions | Yes — 1 + 14 + 49 = 64 |
| WAL-6 retained as historical umbrella | Yes — Appendix A |
| 2.12 renamed to Authentication Production Validation | Yes — auth-only; infra excluded |
| Repository Observations separated from engineering issues | Yes — Appendix B |
| Implementation vs governance visually separated | Yes — 2.1–2.11 vs 2.12–2.14 |
| No invented MFA/OAuth/email-provider implementation claims | Yes |
| Linear mutations in this phase | None |

---

## Document control

| Field | Value |
|---|---|
| Created | 2026-07-19 |
| Location | `docs/product/Part-02-Authentication-Governance-Roadmap.md` |
| Nature | Retrospective governing reconstruction |
| Count | 1 umbrella + 14 mains + 49 sub-issues = **64** (proposed under WAL-6) |
| Historical Linear | WAL-6 retained |
| Next action | Engineering review/approval of this roadmap, then Linear creation under WAL-6 only after explicit approval |
