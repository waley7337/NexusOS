# Part 2 — Authentication  
## Linear Import Prep (Evidence-Enriched)

**Status:** Draft for engineering review — **do not import to Linear until approved**  
**Governs:** Canonical decomposition under historical umbrella **WAL-6**  
**Counts:** 1 umbrella + 14 mains + 49 sub-issues = **64**  
**Companion roadmap:** `docs/product/Part-02-Authentication-Governance-Roadmap.md`

**Evidence baseline**

| Artifact | Identity |
|---|---|
| Completion report | `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md` |
| Implementation commit | `9ff16e5` — `feat(auth): complete Part 02 authentication milestone` |
| Report commit | `309466b` — `docs(part-02): add authentication engineering completion report` |
| Auth migrations | `0a961c2ea2cf` (initial schema), `382d8497298e` (sessions + auth_tokens) |
| Historical Linear | WAL-6 — retain; attach this tree beneath it |

**Missing documentation (discovery)**

| Missing artifact | Impact |
|---|---|
| Part 2 independent engineering review | No finding IDs; § Engineering Review = N/A |
| Part 2 remediation / re-review / final verification pack | N/A |
| Separate Part 2 “implementation report” | Referenced only in `email_service.py` docstring; file absent |
| Dedicated validation/test reports beyond completion report | Validation evidence is the completion report + automated tests |
| Production auth evidence pack as separate files | Contained narratively in completion report §§4.2–4.3, §9 |

---

## Report-to-issue traceability

| Completion report section | Maps to hierarchy |
|---|---|
| §1 Executive Summary | 2 umbrella; 2.12; 2.13 |
| §2 Delivered Scope (register/login/me/sessions) | 2.4, 2.5, 2.6, 2.7, 2.9, 2.10 |
| §2 (infra bullets: CORS/SPA/Railway/Sentry) | **Not** Part 2 auth parents — deployment adjacency; auth validation only in 2.12 |
| §3 Production Architecture | Context for 2.12 (auth path only) |
| §4.2 Schema mismatch / migrations | 2.2; 2.12.3 Authentication migration validation |
| §4.3 Production Authentication Verification | 2.12.1–2.12.2, 2.12.4–2.12.5 |
| §4.4 Vercel SPA | Frontend auth routes reachable — supports 2.10 / 2.12.4; not Vercel infra issue |
| §4.5 Sentry | Out of Part 2 auth hierarchy (deployment observability) |
| §5 Technical Decisions (JWT/Argon2/sessions) | 2.1, 2.3, 2.6 |
| §6 Frontend Auth Architecture | 2.10 |
| §7 Backend Auth Architecture | 2.3–2.9 |
| §8 Known Non-Blocking Items | Appendix observations / not automatic issues |
| §9 Definition of Done (auth rows) | 2.12, 2.13 |
| §10 Final Assessment | 2 umbrella, 2.13 |

**Code/test → issue (summary)**

| Evidence | Issues |
|---|---|
| `auth_service.register` / RegisterPage / register tests | 2.4.* |
| `login` / `get_me` / LoginPage / login-me tests | 2.5.* |
| `refresh` / reuse / session tests | 2.6.* |
| `logout` / `useLogout` | 2.7.* |
| forgot/reset/verify + EmailService + FE pages | 2.8.* |
| `api/v1/auth.py` + schemas | 2.9.* |
| store / interceptor / ProtectedRoute / page tests | 2.10.* |
| `test_auth_service.py` (12) / `test_auth_api.py` (7) / FE tests | 2.11.* |

---

## Updated engineering hierarchy (unchanged structure)

```
WAL-6 (historical umbrella — retain)
└── 2 — Authentication
    ├── IMPLEMENTATION
    │   2.1 … 2.11
    └── GOVERNANCE
        2.12 Authentication Production Validation
        2.13 Engineering Completion Documentation
        2.14 Deferred Capabilities & Downstream Handoff
```

Counts unchanged: **64**.

---

# Recommended Linear descriptions

> Template fields used below are repository-backed. Where a field has no Part 2 artifact, the description states **N/A** explicitly.

---

## 2 — Authentication (umbrella)

**Linear parent:** WAL-6  
**Title:** `02 — Authentication (Canonical Decomposition)`  
*(or)* `2 — Authentication`

### Purpose
Provide the canonical engineering decomposition of Part 2 Authentication beneath the historical WAL-6 umbrella without rewriting Part 2 history.

### Scope
All Part 2 auth capabilities evidenced in `9ff16e5` and the Part 2 completion report: register/login/refresh/logout/me, forgot/reset/verify, FE auth UX, auth schema/migrations, tests, Part 2-era auth production validation, completion documentation, deferred handoff.

### Implementation Summary
Part 2 delivered an end-to-end authentication UX layer (backend + frontend + migrations + tests) and a completion report dated 14 July 2026 claiming Part 2-era production authentication verification.

### Repository Evidence
- Commit `9ff16e5` (52 files; auth milestone)
- `backend/app/api/v1/auth.py`, `services/auth_service.py`, `core/security.py`, `models/auth.py`, `schemas/auth.py`, `services/email_service.py`
- Frontend auth pages/hooks/store/client under `frontend/src/`
- Migrations `0a961c2ea2cf`, `382d8497298e`

### Engineering Report References
- `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md` (commit `309466b`)

### Validation Evidence
- Completion report §§4.3, §9 (production authentication verification claimed)
- Automated: `test_auth_service.py`, `test_auth_api.py`, FE auth tests

### Acceptance Criteria
- Decomposition matches repository evidence
- WAL-6 retained as historical parent
- No invented MFA/OAuth/real-email completion claims

### Definition of Done
- Roadmap approved; Linear children created under WAL-6 per this prep doc

### Deliverables
- This hierarchy; roadmap; completion report (already in repo)

### Dependencies
- WAL-6; Part 1 foundation; schema tables used at registration

### Notes
Post–Part 3.1 auth re-smoke is Part 3.2. Real email remains deferred.

---

## 2.1 — Authentication Requirements & Architecture

**Parent:** 2  
**Labels:** `Architecture`, `security`

### Purpose
Capture Part 2 authentication requirements and the access/refresh/opaque-token architecture actually implemented.

### Scope
Requirements implied by delivered UX/API; JWT session design; opaque tokens for email/reset.

### Implementation Summary
Architecture uses short-lived access JWTs, longer-lived refresh JWTs bound to `sessions.jti`, and hashed opaque tokens in `auth_tokens` for email verification / password reset.

### Repository Evidence
- `backend/app/core/security.py`
- `backend/app/services/auth_service.py`
- `backend/app/models/auth.py`

### Engineering Report References
- Completion report §5 Technical Decisions; §7 Backend Auth Architecture

### Validation Evidence
- Exercised indirectly via auth service/API tests in `9ff16e5`

### Acceptance Criteria
- Architecture choices are traceable to code and completion report §5/§7

### Definition of Done
- Requirements + architecture recorded as completed Part 2 work packages

### Deliverables
- Implemented auth architecture in repo (not a separate design doc)

### Dependencies
- None inside Part 2

### Notes
No standalone Part 2 requirements PDF/MD beyond the completion report.

### Sub-issues

#### 2.1.1 Capture Part 2 authentication requirements
- **Purpose:** Identify auth capabilities Part 2 was required to deliver.  
- **Scope:** Register, login, me, sessions/tokens, company-on-register, recovery/verify (as implemented).  
- **Implementation Summary:** Delivered scope listed in completion report §2 (plus recovery/verify present in code).  
- **Repository Evidence:** Completion report §2; routes in `auth.py`.  
- **Engineering Report References:** §2 Delivered Scope.  
- **Validation Evidence:** §4.3 production auth verification; local tests.  
- **Acceptance Criteria:** Requirements map to implemented routes/pages.  
- **Definition of Done:** Traceability complete.  
- **Deliverables:** Evidence in report + code.  
- **Dependencies:** None.  
- **Notes:** Report §2 omits forgot/reset/verify; code includes them (Repository Observation).

#### 2.1.2 Record access / refresh / opaque-token architecture
- **Purpose:** Document token types and lifetimes as implemented.  
- **Scope:** Access JWT, refresh JWT + Session, opaque AuthToken purposes.  
- **Implementation Summary:** `create_access_token` / `create_refresh_token` / `generate_opaque_token` + `AuthTokenPurpose`.  
- **Repository Evidence:** `security.py`; `models/enums.py`; `models/auth.py`.  
- **Engineering Report References:** §5 Technical Decisions.  
- **Validation Evidence:** refresh/reuse/verify/reset tests.  
- **Acceptance Criteria:** Three token classes evidenced.  
- **Definition of Done:** Architecture package closed.  
- **Deliverables:** Code primitives.  
- **Dependencies:** 2.1.1.  
- **Notes:** TTLs configured via settings (access ~15m, refresh ~30d per security helpers/defaults).

---

## 2.2 — Auth Data Model & Migrations

**Parent:** 2  
**Labels:** `backend`

### Purpose
Persist authentication state in PostgreSQL via SQLAlchemy models and Alembic migrations.

### Scope
User/company auth fields; `sessions`; `auth_tokens`.

### Implementation Summary
Initial schema creates companies/users/roles; follow-up migration adds `sessions` and `auth_tokens`.

### Repository Evidence
- `backend/app/models/user.py`, `company.py`, `auth.py`
- `migrations/versions/20260709_0a961c2ea2cf_initial_schema.py`
- `migrations/versions/20260714_382d8497298e_add_sessions_and_auth_tokens_tables.py`

### Engineering Report References
- Completion report §4.2 (migration chain: initial schema → sessions/auth_tokens)

### Validation Evidence
- §4.2 production migration execution claimed; local tests use migrated schema

### Acceptance Criteria
- Models and migrations exist and match auth service expectations

### Definition of Done
- Auth tables/columns available to auth_service

### Deliverables
- Migrations + models

### Dependencies
- 2.1

### Sub-issues

#### 2.2.1 User / company authentication fields
- **Purpose:** Persist password hash, email verification, user status, company tenant root.  
- **Scope:** `users.password_hash`, `email_verified`, status; `companies` for registration.  
- **Implementation Summary:** Models in `user.py` / `company.py`; created in initial schema.  
- **Repository Evidence:** models + `0a961c2ea2cf`.  
- **Engineering Report References:** §4.2 (`companies` missing caused prod failure before migrate).  
- **Validation Evidence:** register/login tests; §4.2/§4.3.  
- **Acceptance Criteria:** Fields present and used by auth_service.  
- **Definition of Done:** Complete.  
- **Deliverables:** Schema + models.  
- **Dependencies:** None.  
- **Notes:** `two_factor_enabled` column exists without MFA flows (deferred).

#### 2.2.2 `sessions` table migration
- **Purpose:** Store refresh-session rows keyed by `jti`.  
- **Scope:** `sessions` table / `Session` model.  
- **Implementation Summary:** Migration `382d8497298e`; model `Session`.  
- **Repository Evidence:** migration file; `models/auth.py`.  
- **Engineering Report References:** §4.2.  
- **Validation Evidence:** refresh/logout/reuse tests.  
- **Acceptance Criteria:** Session persistence works.  
- **Definition of Done:** Complete.  
- **Deliverables:** Migration + model.  
- **Dependencies:** 2.2.1.  
- **Notes:** IP/UA columns exist; not set in `_issue_session` (residual).

#### 2.2.3 `auth_tokens` table migration
- **Purpose:** Persist opaque email-verification and password-reset tokens.  
- **Scope:** `auth_tokens` / `AuthToken` / `AuthTokenPurpose`.  
- **Implementation Summary:** Same migration `382d8497298e`.  
- **Repository Evidence:** migration; `models/auth.py`; `enums.py`.  
- **Engineering Report References:** §4.2.  
- **Validation Evidence:** verify/reset/forgot service tests.  
- **Acceptance Criteria:** Token consume/single-use works.  
- **Definition of Done:** Complete.  
- **Deliverables:** Migration + model.  
- **Dependencies:** 2.2.1.  
- **Notes:** None.

---

## 2.3 — Password Hashing & JWT Cryptography

**Parent:** 2  
**Labels:** `backend`, `security`

### Purpose
Provide credential hashing and token cryptography primitives for auth flows.

### Scope
Argon2 password hash/verify; access/refresh JWT create/decode; opaque token generate/hash.

### Implementation Summary
Passlib Argon2 context; HS256 JWTs via `SECRET_KEY`; SHA-256 opaque token hashing.

### Repository Evidence
- `backend/app/core/security.py` (`hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token`, `generate_opaque_token`, `hash_opaque_token`)

### Engineering Report References
- Completion report §5 Technical Decisions; §7 Backend Auth Architecture

### Validation Evidence
- Password/login/refresh/reset tests in `test_auth_service.py`

### Acceptance Criteria
- Primitives used by auth_service for all credential/token operations

### Definition of Done
- Complete in `9ff16e5`

### Deliverables
- `security.py` helpers

### Dependencies
- 2.2

### Sub-issues

#### 2.3.1 Argon2 password hashing
- **Purpose:** Hash and verify passwords.  
- **Scope:** `hash_password` / `verify_password`.  
- **Implementation Summary:** Passlib `CryptContext(schemes=["argon2"])`.  
- **Repository Evidence:** `security.py`; used in register/login/reset.  
- **Engineering Report References:** §5.  
- **Validation Evidence:** `test_login_succeeds_with_correct_password_and_fails_otherwise`; reset password test.  
- **Acceptance Criteria:** Weak/wrong passwords rejected; correct verifies.  
- **Definition of Done:** Complete.  
- **Deliverables:** Hashing helpers.  
- **Dependencies:** None.  
- **Notes:** None.

#### 2.3.2 Access JWT issue / decode
- **Purpose:** Issue/decode short-lived access tokens with tenant/role claims.  
- **Scope:** `create_access_token`, `decode_token(..., access)`.  
- **Implementation Summary:** Claims include `sub`, `type=access`, `company_id`, `role`, `jti`.  
- **Repository Evidence:** `security.py`; consumed by deps/auth routes.  
- **Engineering Report References:** §5/§7.  
- **Validation Evidence:** login→me API round trip.  
- **Acceptance Criteria:** Access token authorizes `/me`.  
- **Definition of Done:** Complete.  
- **Deliverables:** Access JWT helpers.  
- **Dependencies:** 2.3.1.  
- **Notes:** Fresh-DB authz hardening later in Part 3.1 — not Part 2 scope.

#### 2.3.3 Refresh JWT + opaque token helpers
- **Purpose:** Support refresh sessions and email/reset opaque tokens.  
- **Scope:** `create_refresh_token`; opaque generate/hash.  
- **Implementation Summary:** Refresh `type=refresh`; opaque tokens hashed at rest.  
- **Repository Evidence:** `security.py`; `auth_service` session/token flows.  
- **Engineering Report References:** §5.  
- **Validation Evidence:** refresh rotation/reuse; verify/reset token tests.  
- **Acceptance Criteria:** Helpers support session + auth_token flows.  
- **Definition of Done:** Complete.  
- **Deliverables:** Helpers.  
- **Dependencies:** 2.3.2.  
- **Notes:** None.

---

## 2.4 — Registration & Multi-Tenant Bootstrap

**Parent:** 2  
**Labels:** `backend`, `frontend`

### Purpose
Register a new user with a new company and Owner role bootstrap, returning an auth session.

### Scope
Slugified unique company; `DEFAULT_ROLES` bootstrap; user create; `POST /auth/register`; Register FE + tests.

### Implementation Summary
`auth_service.register` creates company, roles, owner user, email-verification token, issues session; FE RegisterPage + hooks/schemas/tests.

### Repository Evidence
- `auth_service.register`, `_unique_slug`, `_bootstrap_company_roles`
- `POST /auth/register` in `api/v1/auth.py`
- `frontend/src/pages/auth/RegisterPage.tsx`, `useRegister.ts`, `registerSchema.ts`
- Tests: `test_register_*` (service/API), `RegisterPage.test.tsx`

### Engineering Report References
- §2 Delivered Scope (registration, company/workspace creation)
- §4.3 (registration + company creation succeeded in production)

### Validation Evidence
- Local: register envelope 201; weak password rejection; unique slugs; same email two companies
- Production (report): registration + company creation succeeded

### Acceptance Criteria
- Register creates tenant+owner+session; FE works; tests pass

### Definition of Done
- Complete in `9ff16e5` + report §4.3

### Deliverables
- Backend + FE registration

### Dependencies
- 2.2, 2.3

### Sub-issues

#### 2.4.1 Company + slug bootstrap
- **Purpose:** Create unique company slug on register.  
- **Scope:** `_slugify`, `_unique_slug`, Company insert.  
- **Implementation Summary:** Unique slug generation for company name.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** §2; §4.3.  
- **Validation Evidence:** `test_register_generates_unique_slugs_for_same_company_name`.  
- **Acceptance Criteria:** Collision-safe slugs.  
- **Definition of Done:** Complete.  
- **Deliverables:** Company bootstrap logic.  
- **Dependencies:** 2.2.1.  
- **Notes:** None.

#### 2.4.2 System role seeding (`DEFAULT_ROLES`)
- **Purpose:** Seed company roles/permissions at registration.  
- **Scope:** `_bootstrap_company_roles`.  
- **Implementation Summary:** Boots roles from seed catalog; assigns Owner.  
- **Repository Evidence:** `auth_service.py`; seed defaults.  
- **Engineering Report References:** §2 company/workspace creation.  
- **Validation Evidence:** `test_register_creates_company_owner_and_session`; `test_get_me_flattens_owner_permissions_to_full_catalog`.  
- **Acceptance Criteria:** Owner receives permission catalog.  
- **Definition of Done:** Complete.  
- **Deliverables:** Role bootstrap.  
- **Dependencies:** 2.4.1.  
- **Notes:** None.

#### 2.4.3 Register service + `POST /register`
- **Purpose:** HTTP + service registration entrypoint.  
- **Scope:** `register` service; `POST /api/v1/auth/register`.  
- **Implementation Summary:** Creates user with Argon2 hash; issues tokens; audit event.  
- **Repository Evidence:** `auth_service.py`; `auth.py`.  
- **Engineering Report References:** §2; §4.3; §7.  
- **Validation Evidence:** `test_register_returns_standard_envelope_with_tokens`; validation 422 test.  
- **Acceptance Criteria:** 201 envelope with tokens on success.  
- **Definition of Done:** Complete.  
- **Deliverables:** API + service.  
- **Dependencies:** 2.4.2, 2.3.  
- **Notes:** Rate-limit dependency may be Part 3.1 overlay on route.

#### 2.4.4 Register frontend + tests
- **Purpose:** UX for registration.  
- **Scope:** RegisterPage, schema, hook, page test.  
- **Implementation Summary:** Form → `authService.register`.  
- **Repository Evidence:** `RegisterPage.tsx`; `useRegister.ts`; `RegisterPage.test.tsx`.  
- **Engineering Report References:** §6 Frontend Auth Architecture.  
- **Validation Evidence:** FE page tests (3 cases).  
- **Acceptance Criteria:** FE register path covered.  
- **Definition of Done:** Complete.  
- **Deliverables:** FE register.  
- **Dependencies:** 2.4.3.  
- **Notes:** None.

---

## 2.5 — Login & Authenticated Identity

**Parent:** 2  
**Labels:** `backend`, `frontend`

### Purpose
Authenticate credentials and expose current-user identity/permissions.

### Scope
`login`, `get_me`, `GET /auth/me`, Login FE, login/me tests.

### Implementation Summary
Cross-tenant email login with password verify; session issue; `/me` flattens permissions; LoginPage + tests.

### Repository Evidence
- `auth_service.login`, `get_me`
- `GET /auth/me`
- `LoginPage.tsx`, `useLogin.ts`
- Tests: login service/API; `LoginPage.test.tsx`

### Engineering Report References
- §2 login + `/me`; §4.3 login succeeded; §6/§7

### Validation Evidence
- `test_login_then_me_round_trip`; wrong password 401; production login claimed in §4.3

### Acceptance Criteria
- Login issues tokens; `/me` authorized; FE login works

### Definition of Done
- Complete

### Deliverables
- Login + me surfaces

### Dependencies
- 2.3, 2.4

### Sub-issues

#### 2.5.1 Login service
- **Purpose:** Validate credentials and issue session.  
- **Scope:** `auth_service.login`.  
- **Implementation Summary:** Password verify; suspend checks; `last_login_at`; audit.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** §7.  
- **Validation Evidence:** `test_login_succeeds_with_correct_password_and_fails_otherwise`.  
- **Acceptance Criteria:** Correct password succeeds; incorrect fails.  
- **Definition of Done:** Complete.  
- **Deliverables:** Login service.  
- **Dependencies:** 2.3.1.  
- **Notes:** None.

#### 2.5.2 `GET /me` + permission flatten
- **Purpose:** Return authenticated user profile and permissions.  
- **Scope:** `get_me`; `_flatten_permissions`; route `/me`.  
- **Implementation Summary:** Builds `MeResponse` from current user.  
- **Repository Evidence:** `auth_service.py`; `auth.py`.  
- **Engineering Report References:** §2 Authenticated `/me` flow.  
- **Validation Evidence:** `test_get_me_flattens_owner_permissions_to_full_catalog`; API me round trip.  
- **Acceptance Criteria:** Permissions list returned for owner.  
- **Definition of Done:** Complete.  
- **Deliverables:** `/me` API.  
- **Dependencies:** 2.5.1.  
- **Notes:** `get_current_active_user` strengthened in Part 3.1.

#### 2.5.3 Login frontend
- **Purpose:** UX login.  
- **Scope:** LoginPage, schema, hook.  
- **Implementation Summary:** Submits credentials; stores tokens.  
- **Repository Evidence:** `LoginPage.tsx`; `useLogin.ts`; `loginSchema.ts`.  
- **Engineering Report References:** §6.  
- **Validation Evidence:** `LoginPage.test.tsx` (5 cases).  
- **Acceptance Criteria:** FE login covered.  
- **Definition of Done:** Complete.  
- **Deliverables:** Login UX.  
- **Dependencies:** 2.5.1.  
- **Notes:** None.

#### 2.5.4 Login / me API tests
- **Purpose:** HTTP-level login/me coverage.  
- **Scope:** `test_auth_api` login/me cases.  
- **Implementation Summary:** Round trip + unauthorized cases.  
- **Repository Evidence:** `test_auth_api.py`.  
- **Engineering Report References:** Supports §9 backend tests passing.  
- **Validation Evidence:** Tests themselves.  
- **Acceptance Criteria:** Tests present and green in CI/local.  
- **Definition of Done:** Complete.  
- **Deliverables:** API tests.  
- **Dependencies:** 2.5.1–2.5.2.  
- **Notes:** None.

---

## 2.6 — Refresh Token Session Lifecycle

**Parent:** 2  
**Labels:** `backend`, `security`

### Purpose
Rotate refresh sessions safely; detect reuse; honor session expiry.

### Scope
`_issue_session`, `refresh`, reuse revoke-all, expiry tests.

### Implementation Summary
Refresh decodes JWT → Session by jti; rotates; on reuse revokes all sessions (commit-before-raise path evidenced in later hardening notes); expiry enforced via `Session.expires_at`.

### Repository Evidence
- `auth_service.refresh`, `_issue_session`, `_revoke_all_sessions`
- `models/auth.py` `Session`
- Tests: `test_refresh_rotates_and_rejects_reuse`; `test_refresh_reuse_revokes_every_session_for_the_user`; `tests/security/test_session_security.py` (later overlay still validates invariant)

### Engineering Report References
- §2 Session and authentication-token persistence; §5/§7

### Validation Evidence
- Service refresh/reuse tests in `9ff16e5`; session expiry tests in security suite

### Acceptance Criteria
- Rotation works; reuse fails closed; expired session cannot refresh

### Definition of Done
- Complete

### Deliverables
- Refresh lifecycle

### Dependencies
- 2.2.2, 2.3.3

### Sub-issues

#### 2.6.1 Session issue on authentication
- **Purpose:** Create Session + token pair on register/login.  
- **Scope:** `_issue_session`.  
- **Implementation Summary:** Persists jti/expiry; returns TokenPair.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** §2 sessions persistence.  
- **Validation Evidence:** register/login tests assert session/tokens.  
- **Acceptance Criteria:** Session row created.  
- **Definition of Done:** Complete.  
- **Deliverables:** Session issue helper.  
- **Dependencies:** 2.2.2.  
- **Notes:** IP/UA not populated at issue time.

#### 2.6.2 Refresh token rotation
- **Purpose:** Rotate refresh tokens on `/auth/refresh`.  
- **Scope:** `refresh` happy path.  
- **Implementation Summary:** Revokes old session; issues new pair.  
- **Repository Evidence:** `auth_service.refresh`; `POST /auth/refresh`.  
- **Engineering Report References:** §5/§7.  
- **Validation Evidence:** `test_refresh_rotates_and_rejects_reuse`.  
- **Acceptance Criteria:** New refresh invalidates previous.  
- **Definition of Done:** Complete.  
- **Deliverables:** Refresh rotation.  
- **Dependencies:** 2.6.1.  
- **Notes:** None.

#### 2.6.3 Refresh-reuse compromise detection
- **Purpose:** On reuse of revoked refresh, revoke all user sessions.  
- **Scope:** Reuse branch in `refresh`.  
- **Implementation Summary:** Detects reused jti; `_revoke_all_sessions`; raises unauthorized.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** §7 (session security intent).  
- **Validation Evidence:** `test_refresh_reuse_revokes_every_session_for_the_user`.  
- **Acceptance Criteria:** All sessions revoked on reuse.  
- **Definition of Done:** Complete.  
- **Deliverables:** Compromise handling.  
- **Dependencies:** 2.6.2.  
- **Notes:** Explicit commit-before-raise refined in Part 3.1 remediation history.

#### 2.6.4 Session expiry regression tests
- **Purpose:** Ensure `Session.expires_at` gates refresh.  
- **Scope:** Expiry tests.  
- **Implementation Summary:** Security suite proves expired session cannot refresh.  
- **Repository Evidence:** `backend/tests/security/test_session_security.py` (Part 3.1-era file validating Part 2 model).  
- **Engineering Report References:** Complements §5 session model.  
- **Validation Evidence:** That test file.  
- **Acceptance Criteria:** Expiry authoritative over JWT exp alone.  
- **Definition of Done:** Complete (invariant covered).  
- **Deliverables:** Regression tests.  
- **Dependencies:** 2.6.1.  
- **Notes:** Test file may post-date Part 2 commit; invariant is Part 2’s Session model.

---

## 2.7 — Logout & Session Revocation

**Parent:** 2  
**Labels:** `backend`, `frontend`

### Purpose
Revoke refresh session on logout and clear FE auth state.

### Scope
`logout` service/route; `useLogout` / store clear.

### Implementation Summary
Idempotent revoke by refresh jti; FE logout hook clears persisted tokens.

### Repository Evidence
- `auth_service.logout`; `POST /auth/logout`
- `frontend/src/features/auth/hooks/useLogout.ts`; `stores/auth.ts`

### Engineering Report References
- Implied by session persistence + UX auth architecture §6/§7

### Validation Evidence
- `test_logout_revokes_the_session`

### Acceptance Criteria
- Logout revokes session; FE clears auth

### Definition of Done
- Complete

### Deliverables
- Logout BE+FE

### Dependencies
- 2.6

### Sub-issues

#### 2.7.1 Logout revoke-by-jti
- **Purpose:** Server-side session revoke.  
- **Scope:** `logout`.  
- **Implementation Summary:** Marks session revoked.  
- **Repository Evidence:** `auth_service.py`; `auth.py`.  
- **Engineering Report References:** §7.  
- **Validation Evidence:** `test_logout_revokes_the_session`.  
- **Acceptance Criteria:** Session invalid after logout.  
- **Definition of Done:** Complete.  
- **Deliverables:** Logout API.  
- **Dependencies:** 2.6.1.  
- **Notes:** None.

#### 2.7.2 Frontend logout wiring
- **Purpose:** Client logout UX/state.  
- **Scope:** `useLogout`, store clear, API call.  
- **Implementation Summary:** Calls logout endpoint; clears `abos-auth` persist.  
- **Repository Evidence:** `useLogout.ts`; `stores/auth.ts`.  
- **Engineering Report References:** §6.  
- **Validation Evidence:** Hook/store present in `9ff16e5` (page-level coverage via auth flows).  
- **Acceptance Criteria:** Tokens cleared client-side.  
- **Definition of Done:** Complete.  
- **Deliverables:** FE logout.  
- **Dependencies:** 2.7.1.  
- **Notes:** None.

---

## 2.8 — Password Reset & Email Verification

**Parent:** 2  
**Labels:** `backend`, `frontend`, `security`

### Purpose
Provide forgot/reset/verify token flows with a replaceable email seam.

### Scope
forgot/reset/verify services+routes; `EmailService` log-only; FE pages/tests.

### Implementation Summary
Opaque tokens in `auth_tokens`; enumeration-safe forgot ack; reset rehashes + revokes sessions; verify sets `email_verified`; email links logged via `EmailService`.

### Repository Evidence
- `forgot_password`, `reset_password`, `verify_email`, `_consume_token`
- Routes in `auth.py`
- `email_service.py`
- FE pages + tests for forgot/reset/verify

### Engineering Report References
- **Not listed** in completion report §2 delivered bullets (Repository Observation)
- Code/tests in `9ff16e5` are authoritative

### Validation Evidence
- `test_forgot_password_is_silent_for_unknown_email`
- `test_reset_password_updates_credential_and_revokes_sessions`
- `test_verify_email_marks_user_verified_and_token_single_use`
- `test_forgot_password_always_returns_success_envelope`
- FE page tests

### Acceptance Criteria
- Token flows work; email seam does not require provider for Part 2 close

### Definition of Done
- Complete (delivery deferred)

### Deliverables
- Recovery/verify stack + log-only email

### Dependencies
- 2.2.3, 2.3

### Sub-issues

#### 2.8.1 Forgot-password flow
- **Purpose:** Accept forgot requests without account enumeration.  
- **Scope:** `forgot_password`; `POST /forgot-password`.  
- **Implementation Summary:** Always ack; creates reset token if user exists; calls email seam.  
- **Repository Evidence:** `auth_service.py`; `auth.py`.  
- **Engineering Report References:** N/A in §2 list — code authoritative.  
- **Validation Evidence:** silent unknown email; API always success envelope.  
- **Acceptance Criteria:** Enumeration-safe.  
- **Definition of Done:** Complete.  
- **Deliverables:** Forgot API.  
- **Dependencies:** 2.2.3.  
- **Notes:** None.

#### 2.8.2 Reset-password flow
- **Purpose:** Consume reset token; set new password; revoke sessions.  
- **Scope:** `reset_password`; `POST /reset-password`.  
- **Implementation Summary:** `_consume_token` PASSWORD_RESET; rehash; revoke all sessions.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** N/A in §2 — code authoritative.  
- **Validation Evidence:** `test_reset_password_updates_credential_and_revokes_sessions`.  
- **Acceptance Criteria:** Password updated; sessions revoked.  
- **Definition of Done:** Complete.  
- **Deliverables:** Reset API.  
- **Dependencies:** 2.8.1, 2.3.1.  
- **Notes:** None.

#### 2.8.3 Verify-email flow
- **Purpose:** Consume verification token; mark email verified.  
- **Scope:** `verify_email`; `POST /verify-email`.  
- **Implementation Summary:** Single-use token consume.  
- **Repository Evidence:** `auth_service.py`.  
- **Engineering Report References:** N/A in §2 — code authoritative.  
- **Validation Evidence:** `test_verify_email_marks_user_verified_and_token_single_use`.  
- **Acceptance Criteria:** Verified flag set; reuse fails.  
- **Definition of Done:** Complete.  
- **Deliverables:** Verify API.  
- **Dependencies:** 2.2.3.  
- **Notes:** Token created at register.

#### 2.8.4 Log-only `EmailService` seam
- **Purpose:** Provide swappable email boundary without provider dependency.  
- **Scope:** `email_service.py`.  
- **Implementation Summary:** Logs verification/reset links at INFO using `FRONTEND_URL`.  
- **Repository Evidence:** `backend/app/services/email_service.py`.  
- **Engineering Report References:** Not described in completion report; docstring references missing “implementation report”.  
- **Validation Evidence:** Indirect via forgot/verify flows (no SMTP assert).  
- **Acceptance Criteria:** Seam exists; no Resend client required.  
- **Definition of Done:** Complete — documented deferred delivery.  
- **Deliverables:** Email seam.  
- **Dependencies:** None.  
- **Notes:** Real provider = 2.14.1.

#### 2.8.5 Frontend recovery / verify pages
- **Purpose:** UX for forgot/reset/verify.  
- **Scope:** three pages + hooks/schemas/tests.  
- **Implementation Summary:** Pages call authService endpoints.  
- **Repository Evidence:** `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx` + `__tests__`.  
- **Engineering Report References:** §6 architecture (auth pages).  
- **Validation Evidence:** FE tests (3+4+3 cases).  
- **Acceptance Criteria:** Pages covered.  
- **Definition of Done:** Complete.  
- **Deliverables:** FE recovery/verify.  
- **Dependencies:** 2.8.1–2.8.3.  
- **Notes:** None.

---

## 2.9 — Auth HTTP API & Contracts

**Parent:** 2  
**Labels:** `backend`

### Purpose
Expose consistent `/api/v1/auth` HTTP contracts for the UX layer.

### Scope
Eight routes; Pydantic schemas; standard response envelopes.

### Implementation Summary
Router prefix `/auth` under `/api/v1`; camelCase schema aliases; envelope responses tested.

### Repository Evidence
- `backend/app/api/v1/auth.py`
- `backend/app/schemas/auth.py`
- `backend/app/api/v1/router.py`

### Engineering Report References
- §7 Backend Auth Architecture

### Validation Evidence
- `test_auth_api.py` envelope/validation/authz cases

### Acceptance Criteria
- All auth routes present; contracts enforced

### Definition of Done
- Complete

### Deliverables
- Auth API surface

### Dependencies
- 2.4–2.8 services

### Sub-issues

#### 2.9.1 Route surface under `/api/v1/auth`
- **Purpose:** Mount auth endpoints.  
- **Scope:** register/login/refresh/logout/me/forgot/reset/verify.  
- **Implementation Summary:** FastAPI router handlers.  
- **Repository Evidence:** `auth.py`.  
- **Engineering Report References:** §7.  
- **Validation Evidence:** API tests hit routes.  
- **Acceptance Criteria:** Eight routes exist.  
- **Definition of Done:** Complete.  
- **Deliverables:** Routes.  
- **Dependencies:** Services.  
- **Notes:** Rate-limit Depends may be Part 3.1 additions.

#### 2.9.2 Request / response contracts (Pydantic)
- **Purpose:** Validate payloads and shape responses.  
- **Scope:** `schemas/auth.py`.  
- **Implementation Summary:** Register/Login/Refresh/Logout/Forgot/Reset/Verify + TokenPair/Me responses.  
- **Repository Evidence:** `schemas/auth.py`.  
- **Engineering Report References:** §7.  
- **Validation Evidence:** `test_register_validation_error_shape`; FE zod schemas aligned.  
- **Acceptance Criteria:** Invalid payloads 422.  
- **Definition of Done:** Complete.  
- **Deliverables:** Schemas.  
- **Dependencies:** None.  
- **Notes:** None.

#### 2.9.3 Response envelope consistency
- **Purpose:** Standard success/error envelope for auth API.  
- **Scope:** API responses tested for envelope shape.  
- **Implementation Summary:** Shared API envelope used by auth routes.  
- **Repository Evidence:** `test_register_returns_standard_envelope_with_tokens`; forgot success envelope test.  
- **Engineering Report References:** Supports API standards practice.  
- **Validation Evidence:** API tests.  
- **Acceptance Criteria:** Envelope fields present.  
- **Definition of Done:** Complete.  
- **Deliverables:** Envelope-consistent auth API.  
- **Dependencies:** 2.9.1.  
- **Notes:** None.

---

## 2.10 — Frontend Auth UX, Store & Client

**Parent:** 2  
**Labels:** `frontend`

### Purpose
Deliver auth UX with persisted tokens and silent refresh.

### Scope
Routes/layout; Zustand persist; Axios refresh interceptor; ProtectedRoute; page tests.

### Implementation Summary
Auth pages under `/login` etc.; `abos-auth` persist; single-flight refresh in `api/client.ts`; guard redirects unauthenticated users.

### Repository Evidence
- `frontend/src/pages/auth/*`
- `frontend/src/layouts/AuthLayout.tsx`
- `frontend/src/stores/auth.ts`
- `frontend/src/api/client.ts`
- `frontend/src/routes/ProtectedRoute.tsx`, `routes/index.tsx`
- Page `__tests__/*`

### Engineering Report References
- §6 Frontend Auth Architecture
- §4.4 SPA routing (auth pages resolve on direct load — FE concern)

### Validation Evidence
- FE page/service/schema tests; production SPA routing claimed in §4.4 for auth pages

### Acceptance Criteria
- Persist + refresh + guard + pages complete

### Definition of Done
- Complete in `9ff16e5`

### Deliverables
- FE auth client stack

### Dependencies
- 2.9

### Sub-issues

#### 2.10.1 Auth routes and layout
- **Purpose:** Route table + AuthLayout for auth pages.  
- **Scope:** `routes.ts`, `routes/index.tsx`, `AuthLayout.tsx`.  
- **Implementation Summary:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`.  
- **Repository Evidence:** those files.  
- **Engineering Report References:** §6; §4.4.  
- **Validation Evidence:** Page tests render under routes.  
- **Acceptance Criteria:** Routes exist.  
- **Definition of Done:** Complete.  
- **Deliverables:** Routing.  
- **Dependencies:** None.  
- **Notes:** None.

#### 2.10.2 Zustand token persistence
- **Purpose:** Persist access/refresh/user across reloads.  
- **Scope:** `stores/auth.ts`.  
- **Implementation Summary:** Persist key `abos-auth`.  
- **Repository Evidence:** `stores/auth.ts`.  
- **Engineering Report References:** §6.  
- **Validation Evidence:** Used by login/register/logout hooks.  
- **Acceptance Criteria:** Tokens survive reload.  
- **Definition of Done:** Complete.  
- **Deliverables:** Auth store.  
- **Dependencies:** None.  
- **Notes:** None.

#### 2.10.3 Axios refresh interceptor
- **Purpose:** Silent refresh on 401; single-flight.  
- **Scope:** `api/client.ts` refresh logic.  
- **Implementation Summary:** `POST /auth/refresh`; persist rotated tokens; sessionExpired redirect.  
- **Repository Evidence:** `frontend/src/api/client.ts`.  
- **Engineering Report References:** §6.  
- **Validation Evidence:** Implementation in `9ff16e5` (+ later debug logs observation).  
- **Acceptance Criteria:** Refresh path present.  
- **Definition of Done:** Complete.  
- **Deliverables:** Interceptor.  
- **Dependencies:** 2.10.2, 2.6.  
- **Notes:** Residual `console.log` debug — observation only.

#### 2.10.4 `ProtectedRoute` guard
- **Purpose:** Block unauthenticated app routes.  
- **Scope:** `ProtectedRoute.tsx`.  
- **Implementation Summary:** Redirect to login with `from` when no token.  
- **Repository Evidence:** `routes/ProtectedRoute.tsx`.  
- **Engineering Report References:** §6.  
- **Validation Evidence:** Component present; used by router.  
- **Acceptance Criteria:** Guard wired.  
- **Definition of Done:** Complete.  
- **Deliverables:** Guard.  
- **Dependencies:** 2.10.2.  
- **Notes:** None.

#### 2.10.5 Auth page test suite
- **Purpose:** FE regression for auth pages.  
- **Scope:** five page test files.  
- **Implementation Summary:** Mocked service UX tests.  
- **Repository Evidence:** `pages/auth/__tests__/*`.  
- **Engineering Report References:** Supports FE quality.  
- **Validation Evidence:** 18 `it(...)` cases across pages.  
- **Acceptance Criteria:** Suite exists.  
- **Definition of Done:** Complete.  
- **Deliverables:** FE tests.  
- **Dependencies:** 2.10.1.  
- **Notes:** None.

---

## 2.11 — Auth Regression Test Suite

**Parent:** 2  
**Labels:** `Testing&Verification`

### Purpose
Keep Part 2 auth invariants under automated regression.

### Scope
Service tests (12), API tests (7), FE authService/schema tests.

### Implementation Summary
Pytest auth modules + Vitest/FE auth tests added in `9ff16e5`.

### Repository Evidence
- `backend/tests/test_auth_service.py`
- `backend/tests/test_auth_api.py`
- `frontend/src/features/auth/tests/authService.test.ts`
- `frontend/src/features/auth/tests/schemas.test.ts`

### Engineering Report References
- §9 Definition of Done — backend test suite passing
- §8 warnings noted as non-blocking

### Validation Evidence
- The suites themselves; report claims suite passing at Part 2 close

### Acceptance Criteria
- Core flows covered at service/API/FE unit level

### Definition of Done
- Complete

### Deliverables
- Auth test suites

### Dependencies
- 2.4–2.10

### Sub-issues

#### 2.11.1 `test_auth_service` suite
- **Purpose:** Service-level auth coverage.  
- **Scope:** 12 async tests (register/login/refresh/reuse/logout/me/verify/forgot/reset).  
- **Implementation Summary:** Direct service tests with DB.  
- **Repository Evidence:** `test_auth_service.py`.  
- **Engineering Report References:** §9.  
- **Validation Evidence:** File.  
- **Acceptance Criteria:** Suite present.  
- **Definition of Done:** Complete.  
- **Deliverables:** Service tests.  
- **Dependencies:** Services.  
- **Notes:** None.

#### 2.11.2 `test_auth_api` suite
- **Purpose:** HTTP-level auth coverage.  
- **Scope:** 7 tests (register envelope/validation, login/me, 401s, forgot, refresh garbage).  
- **Implementation Summary:** TestClient against app.  
- **Repository Evidence:** `test_auth_api.py`.  
- **Engineering Report References:** §9.  
- **Validation Evidence:** File.  
- **Acceptance Criteria:** Suite present.  
- **Definition of Done:** Complete.  
- **Deliverables:** API tests.  
- **Dependencies:** Routes.  
- **Notes:** None.

#### 2.11.3 Frontend auth service / schema tests
- **Purpose:** Client contract/schema coverage.  
- **Scope:** `authService.test.ts`, `schemas.test.ts`.  
- **Implementation Summary:** Endpoint wiring + zod schema tests.  
- **Repository Evidence:** FE test files.  
- **Engineering Report References:** §6 quality.  
- **Validation Evidence:** ~15 cases combined.  
- **Acceptance Criteria:** Suites present.  
- **Definition of Done:** Complete.  
- **Deliverables:** FE unit tests.  
- **Dependencies:** FE auth feature module.  
- **Notes:** Page tests counted under 2.10.5.

---

## 2.12 — Authentication Production Validation

**Parent:** 2  
**Labels:** `Testing&Verification`, `security`

### Purpose
Record Part 2-era **authentication** validation evidence (not infrastructure engineering).

### Scope
Auth smoke; auth endpoint validation; auth migration validation; frontend auth validation; auth evidence pack.

### Out of scope
Railway/Vercel deployment work packages; Sentry integration work; general infra configuration.

### Implementation Summary
Completion report §4.2–§4.3 and §9 document production authentication verification after migrations: registration, company creation, login, existing-account login via deployed application.

### Repository Evidence
- Completion report §§4.2, 4.3, 4.4 (SPA for auth pages), §9 auth-related DoD rows
- Commit `309466b`

### Engineering Report References
- Primary and only Part 2 report

### Validation Evidence
- Narrative production verification in report (no separate transcript files in repo)

### Acceptance Criteria
- Auth validation claims traceable to report; post–3.1 re-smoke not claimed here

### Definition of Done
- Part 2-era evidence recorded; handoff to Part 3.2 for superseding proof

### Deliverables
- Report sections as evidence pack

### Dependencies
- 2.4–2.11 implementation

### Sub-issues

#### 2.12.1 Production authentication smoke tests
- **Purpose:** Evidence register/login auth smoke in production (Part 2-era).  
- **Scope:** Report §4.3 bullets.  
- **Implementation Summary:** Manual production verification after migrations.  
- **Repository Evidence:** Completion report §4.3.  
- **Engineering Report References:** §4.3; §9 “Authentication tested in production”.  
- **Validation Evidence:** Report narrative only (no separate smoke log file).  
- **Acceptance Criteria:** Report records smoke success.  
- **Definition of Done:** Complete (historical).  
- **Deliverables:** Report evidence.  
- **Dependencies:** Auth implementation.  
- **Notes:** Superseding smoke → Part 3.2.

#### 2.12.2 Authentication endpoint validation
- **Purpose:** Confirm auth endpoints functioned in production verification.  
- **Scope:** Registration/login/authenticated session per §4.3.  
- **Implementation Summary:** Exercised via deployed app.  
- **Repository Evidence:** §4.3.  
- **Engineering Report References:** §4.3.  
- **Validation Evidence:** Report.  
- **Acceptance Criteria:** Endpoints validated in Part 2-era.  
- **Definition of Done:** Complete (historical).  
- **Deliverables:** Report.  
- **Dependencies:** 2.9.  
- **Notes:** None.

#### 2.12.3 Authentication migration validation
- **Purpose:** Confirm auth schema migrations applied where auth was verified.  
- **Scope:** Initial schema + sessions/auth_tokens chain in §4.2.  
- **Implementation Summary:** Production migrate fixed missing `companies` / auth tables.  
- **Repository Evidence:** §4.2; migrations in repo.  
- **Engineering Report References:** §4.2.  
- **Validation Evidence:** Report states schema created; subsequent auth succeeded.  
- **Acceptance Criteria:** Auth migrations identified and reported applied.  
- **Definition of Done:** Complete (historical).  
- **Deliverables:** Report §4.2.  
- **Dependencies:** 2.2.  
- **Notes:** This is auth-migration validation, not general DB ops engineering.

#### 2.12.4 Frontend authentication validation
- **Purpose:** Confirm FE auth usable in production verification.  
- **Scope:** Login via deployed application; auth SPA routes.  
- **Implementation Summary:** §4.3 existing account login; §4.4 auth pages resolve.  
- **Repository Evidence:** §§4.3–4.4.  
- **Engineering Report References:** those sections.  
- **Validation Evidence:** Report narrative.  
- **Acceptance Criteria:** FE auth validation recorded.  
- **Definition of Done:** Complete (historical).  
- **Deliverables:** Report.  
- **Dependencies:** 2.10.  
- **Notes:** Does not own Vercel project engineering.

#### 2.12.5 Production authentication evidence pack
- **Purpose:** Preserve the consolidated Part 2 auth validation record.  
- **Scope:** Completion report as evidence pack.  
- **Implementation Summary:** Single markdown report commit `309466b`.  
- **Repository Evidence:** report file.  
- **Engineering Report References:** entire report.  
- **Validation Evidence:** File presence.  
- **Acceptance Criteria:** Evidence pack in repo.  
- **Definition of Done:** Complete.  
- **Deliverables:** Report.  
- **Dependencies:** 2.12.1–2.12.4.  
- **Notes:** No separate attachments folder for Part 2.

---

## 2.13 — Engineering Completion Documentation

**Parent:** 2  
**Labels:** `Documentation`

### Purpose
Preserve the Part 2 engineering completion record in the repository.

### Scope
Author completion report; preserve paths/commits.

### Implementation Summary
`Part-02-Authentication-Engineering-Completion-Report.md` added in `309466b`.

### Repository Evidence
- `docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md`
- Commit `309466b`

### Engineering Report References
- Self

### Validation Evidence
- File exists; cited by WAL-6 / later governance

### Acceptance Criteria
- Report committed with status COMPLETE and auth validation narrative

### Definition of Done
- Complete

### Deliverables
- Completion report

### Dependencies
- 2.12

### Sub-issues

#### 2.13.1 Author Part 2 authentication completion report
- **Purpose:** Write the Part 2 closeout report.  
- **Scope:** Report §§1–10.  
- **Implementation Summary:** 339-line markdown report.  
- **Repository Evidence:** report path; `309466b`.  
- **Engineering Report References:** Self.  
- **Validation Evidence:** File.  
- **Acceptance Criteria:** Report present.  
- **Definition of Done:** Complete.  
- **Deliverables:** Report.  
- **Dependencies:** Implementation complete.  
- **Notes:** Observations about omitted recovery bullets are not separate issues.

#### 2.13.2 Preserve completion evidence paths and commit references
- **Purpose:** Keep durable pointers to Part 2 evidence.  
- **Scope:** Report path + `9ff16e5` / `309466b` (+ supporting history as needed).  
- **Implementation Summary:** Documented in roadmap + this prep + WAL-6 description.  
- **Repository Evidence:** git; docs.  
- **Engineering Report References:** Report header/metadata.  
- **Validation Evidence:** Commits resolvable.  
- **Acceptance Criteria:** Paths/commits recorded in governance docs.  
- **Definition of Done:** Complete when roadmap/prep approved.  
- **Deliverables:** Traceability references.  
- **Dependencies:** 2.13.1.  
- **Notes:** None.

---

## 2.14 — Deferred Capabilities & Downstream Handoff

**Parent:** 2  
**Labels:** `Documentation`, `security`

### Purpose
Keep unfinished/out-of-scope auth capabilities explicit without inventing work.

### Scope
Real email; MFA/OAuth/SSO; session IP/UA residual; Part 3.2 re-smoke handoff.

### Implementation Summary
Email seam is log-only; `two_factor_enabled` unused; Session IP/UA unused at issue; Part 3.2 owns post–3.1 auth re-verification.

### Repository Evidence
- `email_service.py`
- `User.two_factor_enabled` in `user.py`
- `Session` model columns vs `_issue_session`
- Part 3.2 roadmap / WAL-38 family (downstream)

### Engineering Report References
- No Part 2 deferred appendix; inferred from code + later roadmaps

### Validation Evidence
- N/A for deferred items (not delivered)

### Acceptance Criteria
- Deferred/handoff explicitly recorded

### Definition of Done
- Documented

### Deliverables
- Deferred notes in governance

### Dependencies
- 2.13

### Sub-issues

#### 2.14.1 Real transactional email provider follow-up
- **Purpose:** Replace log-only email with real provider when required.  
- **Scope:** Future Resend/SMTP behind `EmailService`.  
- **Implementation Summary:** Not implemented; config keys reserved.  
- **Repository Evidence:** `email_service.py`; config reserved fields.  
- **Engineering Report References:** N/A (gap vs UX copy).  
- **Validation Evidence:** N/A.  
- **Acceptance Criteria:** Future trigger = need real email delivery.  
- **Definition of Done:** Open/deferred.  
- **Deliverables:** Future PR.  
- **Dependencies:** None.  
- **Notes:** Required only when product needs real mail.

#### 2.14.2 MFA / OAuth / SSO out of Part 2 scope
- **Purpose:** Record advanced auth as out of Part 2.  
- **Scope:** No MFA/OAuth/SSO routes.  
- **Implementation Summary:** Schema flag only (`two_factor_enabled`).  
- **Repository Evidence:** `user.py`; absence of OAuth routes.  
- **Engineering Report References:** Not claimed in §2.  
- **Validation Evidence:** N/A.  
- **Acceptance Criteria:** Explicitly out of scope.  
- **Definition of Done:** Documented.  
- **Deliverables:** Note only.  
- **Dependencies:** None.  
- **Notes:** Do not create implementation tasks unless product decides.

#### 2.14.3 Session IP/UA persistence residual
- **Purpose:** Record unused Session metadata columns.  
- **Scope:** `Session.user_agent` / `ip_address` vs `_issue_session`.  
- **Implementation Summary:** Columns exist; not set at issue; audit may capture IP/UA separately (later overlays).  
- **Repository Evidence:** `models/auth.py`; `_issue_session`.  
- **Engineering Report References:** N/A.  
- **Validation Evidence:** N/A.  
- **Acceptance Criteria:** Residual accepted unless product requires.  
- **Definition of Done:** Documented residual.  
- **Deliverables:** Note.  
- **Dependencies:** 2.6.1.  
- **Notes:** Optional future hardening.

#### 2.14.4 Post–Part 3.1 authentication re-smoke → Part 3.2
- **Purpose:** Hand off superseding production auth verification.  
- **Scope:** Ownership boundary only.  
- **Implementation Summary:** Part 3.2 roadmap / Linear auth smoke family.  
- **Repository Evidence:** Part 3.2 governing docs; WAL-38 area.  
- **Engineering Report References:** Part 2 report is Part 2-era only.  
- **Validation Evidence:** N/A in Part 2.  
- **Acceptance Criteria:** Ownership explicit.  
- **Definition of Done:** Handoff recorded.  
- **Deliverables:** Cross-part pointer.  
- **Dependencies:** Part 3.1/3.2.  
- **Notes:** Do not duplicate Part 3.2 work under Part 2.

---

## Import rules (when approved)

1. Parent all new issues under **WAL-6** (umbrella `2` as child of WAL-6; mains under `2`; subs under mains).  
2. Do not edit WAL-6 into a different historical meaning.  
3. Copy descriptions from this document; do not invent extra claims.  
4. Mark statuses to match retrospective completion unless product decides otherwise.  
5. Keep 2.12 free of Railway/Vercel/Sentry infrastructure parents.

---

## Document control

| Field | Value |
|---|---|
| Created | 2026-07-19 |
| Location | `docs/product/Part-02-Authentication-Linear-Import-Prep.md` |
| Companion | `docs/product/Part-02-Authentication-Governance-Roadmap.md` |
| Linear mutations | **None in this phase** |
| Next action | Engineering review/approval → then Linear import under WAL-6 |
