# Part 3.2 — Deployment Configuration & Production Verification

**Project:** NexusOS — AI Business Operating System  
**Status:** Governing engineering roadmap (awaiting Linear sync approval)  
**Audience:** Operators and engineers configuring Railway / Vercel / PostgreSQL / Redis for the post–Part 3.1 security boundary  
**Builds on:**

- Part 1 — Foundation (`docs/reports/Part-01/`)
- Part 2 — Authentication production stack (`docs/reports/Part-02/Part-02-Authentication-Engineering-Completion-Report.md`)
- Part 3 — Database architecture (`docs/product/database.md`)
- Part 3.1 — Backend Security Hardening (`docs/reports/Part-03.1/`)

**This document formally names** the previously unnumbered Part 3.1 next stage  
(“**Deployment Configuration**” in `Part-03.1-Remediation-Re-Review.md` §20) as:

> **Part 3.2 — Deployment Configuration & Production Verification**

**Authority:** Repository product documentation under `docs/product/`.  
Archive roadmaps under `docs/archive/` remain non-governing.  
Rejected chat proposals (Proposal A 19/95 hierarchy; Proposal B seven-epic Part 3 tree) must not be used to create Linear issues.

**Evidence baseline date for this roadmap:** repository HEAD including commits `f521d38`, `5f2a66b`, `75d34ae`, and Part 2 production report `309466b` / related auth deploy commits.

---

## 1. Purpose

Define the minimum configuration, verification, documentation, and evidence required so that:

1. The Part 3.1 security controls that depend on **deployment topology** (trusted proxy / client IP / rate-limit identity / HSTS via forwarded proto) are correctly configured for the real Railway edge.
2. Production boot satisfies `validate_production_config()` (`backend/app/core/config.py`).
3. Health, auth, CORS, Redis, PostgreSQL migrations, logging, and observability are **re-verified after Part 3.1**, with dated evidence.
4. Linear and engineering reports stop claiming “production verified” for Part 3.1 security posture until this part’s Definition of Done is met.

Part 3.2 is a **configuration and verification** phase. It is not a feature build and not a rewrite of Part 3 / 3.1 application code.

---

## 2. Current verified deployment state

| Area | Verified state | Evidence | Classification |
|---|---|---|---|
| Railway FastAPI backend exists | Part 2 reported production deploy | `docs/reports/Part-02/…Completion-Report.md` | **Implemented but not fully verified** for Part 3.1 security posture |
| Railway PostgreSQL exists | Part 2 applied initial auth migrations | Part 2 report §4.2 | **Implemented but not fully verified** at Alembic head after Part 3.1 migrations |
| Redis dependency in code | Rate limiter uses `REDIS_URL` | `backend/app/core/rate_limit.py` | **Implemented** in code; **production Redis topology not evidenced in repo** |
| Vercel frontend + SPA rewrites | `frontend/vercel.json` rewrite to `index.html`; Part 2 verified | `frontend/vercel.json`; commit `68f2301`; Part 2 report | **Implemented**; **re-verify** after API/CORS/proxy changes |
| CORS code path | `CORSMiddleware` from `settings.CORS_ORIGINS` | `backend/app/main.py` | **Implemented**; production origin values are **operator config**, not in repo secrets |
| Trusted-proxy code | `TRUSTED_PROXY_MODE` default `none`; networks default `[]` | `backend/app/core/config.py`; Part 3.1 reports | **Missing configuration** for real Railway edge (blocker) |
| Production config validator | Exists; no-op outside `ENVIRONMENT=production` | `validate_production_config()` | **Implemented**; **real production boot not evidenced** in Part 3.1 reports |
| Health probes | `GET /api/v1/health`, `GET /api/v1/ready` (DB) | `backend/app/api/v1/health.py` | **Implemented**; production probe evidence **not in Part 3.1 pack** |
| Auth API surface | register/login/refresh/logout/me (+ rate limits) | `backend/app/api/v1/auth.py` | **Implemented**; Part 2 smoke exists; **post–3.1 re-smoke required** |
| Sentry integration | Optional `SENTRY_DSN` | `backend/app/main.py`; Part 2 report | **Implemented**; re-verify after config changes |
| Local compose stack | Postgres 16 + Redis 7 + API + web | `docker-compose.yml` | Local only — **not** production proof |
| `.env.example` | Documents DB/Redis/CORS/rate-limit; **omits `TRUSTED_PROXY_*`** | `.env.example` | **Missing documentation** for Part 3.1 deploy knobs |

**Hard rule:** Railway/Vercel being online does **not** mean Part 3.2 (or Part 3.1 production security) is complete.

---

## 3. Known production-readiness gaps

From Part 3.1 governing reports (still authoritative for readiness):

| Gap | Source | Severity for Part 3.2 |
|---|---|---|
| `TRUSTED_PROXY_MODE` / `TRUSTED_PROXY_NETWORKS` unset for real edge | `Part-03.1-Remediation-Re-Review.md` readiness: Deployment Configuration **NOT READY**; follow-up confirms defaults remain `none`/empty | **Blocker** |
| Behind a reverse proxy with mode `none`, rate limiting collapses to shared proxy peer identity | Same reports; SEC-001 operational symptom | **Blocker** until proxy CIDRs verified |
| Production Deployment / Production Traffic **NOT READY** | Re-review §19 | **Blocker** for Part 3.2 closeout |
| No superseding production verification report after Part 3.1 | Only Part 2 production report + Linear claims | **Missing documentation / evidence** |
| DB least-privilege roles, TLS, backups | `Deferred-P1-P2-Recommendations.md` §1 (required before go-live) | **Missing configuration** (production hardening) |
| `/ready` checks DB only — not Redis | `health.py` | Accepted limitation; document; optional improvement out of scope unless blocking deploy |
| VERIFY-001 residual (union of `/1` CIDRs ≈ universal trust) | Final Follow-Up Verification | Optional hardening; document accepted risk if not closed |
| WAL-18 / WAL-28 Linear descriptions claim production verification | Linear (see Appendix A) | **Do not apply corrections until approved** |

---

## 4. Scope

In scope for Part 3.2:

1. Inventory of live Railway / Vercel / Postgres / Redis services and public URLs.
2. Identification and configuration of trusted-proxy CIDRs for the Railway (or current) edge.
3. Production environment variables: `ENVIRONMENT`, `DEBUG`, `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`, `FRONTEND_URL`, `TRUSTED_PROXY_*`, `RATE_LIMIT_*`, `SENTRY_DSN`.
4. Proof that `validate_production_config()` passes on a real production boot.
5. Alembic head verification on the **production** database (including Part 3.1 migrations).
6. Redis connectivity and effective per-client rate limiting **after** proxy trust is correct.
7. CORS preflight + authenticated browser path from the deployed Vercel origin.
8. Health/readiness probe verification against production URLs.
9. Post–Part 3.1 authentication smoke tests (register/login/me/refresh/logout + audit persistence check where feasible).
10. Logging / request-ID / exception / security-header / Sentry spot checks in production.
11. Rollback / recovery runbook for config and migrations.
12. Deployment documentation under `docs/` and a Part 3.2 verification report under `docs/reports/Part-03.2/` (created when evidence exists).
13. Proposed Linear hierarchy in §20 (create only after this roadmap is approved).

---

## 5. Explicit non-goals

- Creating Proposal A or Proposal B Linear hierarchies.
- Reconstructing Part 3.1 into a 9×47 technical issue tree (paused; separate decision).
- Building CRM/HR/Finance business modules or new CRUD APIs.
- Implementing file upload, workers, outbox, RLS (see Part 3.1 deferred notes).
- Changing Part 3 schema design or Part 3.1 security code except for documented hotfixes required to unblock verified production config (prefer config-only fixes).
- Claiming production readiness from local TestClient suites alone.
- Storing secrets, Railway tokens, or production `.env` contents in git.
- Creating Part 3.3 (does not exist in repository).

---

## 6. Security requirements

1. Fail closed on trusted-proxy misconfiguration (`TRUSTED_PROXY_MODE=static` with empty networks must fail production validation — already coded).
2. Never set `TRUSTED_PROXY_NETWORKS` to `0.0.0.0/0` or `::/0` (rejected by Settings validator — NEW-001).
3. Do not guess Railway CIDRs; only use provider-documented or empirically verified peer ranges that match `request.client.host` observed on production.
4. Production `CORS_ORIGINS` must be explicit `https://` origins (no `*`, no empty list).
5. Production `DEBUG=false`; `SECRET_KEY` strong and non-placeholder.
6. Rate limiting must key on **normalized client identity** after proxy trust is correct — prove with two distinct clients behind the same edge.
7. Audit and exception logs must not contain passwords/tokens (redaction already in code; spot-check production).
8. Database must not be publicly reachable; prefer TLS (`sslmode=require` or stricter) on non-localhost `DATABASE_URL` (Deferred §1).

---

## 7. Railway backend requirements

| Requirement | Notes |
|---|---|
| Service online | Necessary but not sufficient |
| `ENVIRONMENT=production` | Required for `validate_production_config` |
| Runtime vars set (see §12) | Via Railway variables UI/CLI — not committed |
| Redeploy after variable changes | Confirm new revision |
| Logs accessible for request-ID / exception checks | Structured JSON expected in production |
| No secrets in repo | Verify `git` clean of `.env` |

---

## 8. Vercel frontend requirements

| Requirement | Notes |
|---|---|
| SPA rewrites | `frontend/vercel.json` already present |
| `VITE_API_BASE_URL` points at production API | `frontend/.env.example` documents local default only |
| Production origin listed in backend `CORS_ORIGINS` | Exact match including scheme/host |
| Auth pages load on hard refresh | SPA rewrite regression check |

---

## 9. PostgreSQL migration requirements

1. Connect to the **Railway production** database (not local `abos` / CI `nexus`).
2. `alembic current` equals `alembic heads` (single head).
3. Confirm Part 3.1 migrations (composite FKs / soft-delete indexes / created_by drift fix) are applied.
4. Document whether migrator vs app DB roles are separated (Deferred §1); if not yet separated, treat as open Part 3.2 work item before sign-off.
5. Record backup posture (existence + last restore drill, or explicit gap).

---

## 10. Redis requirements

1. Production `REDIS_URL` reachable from the Railway API service.
2. `RATE_LIMIT_ENABLED=true` in production.
3. After trusted-proxy config: demonstrate independent budgets for two client IPs (or controlled test) so SEC-001 is operationally closed in production.
4. Document fail-open behavior if Redis is down (`rate_limit.py` logs warning and allows — accepted; note operational impact).

---

## 11. CORS and trusted-proxy requirements

### CORS

- Production `CORS_ORIGINS` includes only the live Vercel HTTPS origin(s).
- Browser preflight to an auth endpoint returns success with expected `Access-Control-Allow-Origin`.
- Credentialed login from the deployed frontend succeeds.

### Trusted proxy

- Inventory how Railway presents `request.client.host` to the app.
- Set `TRUSTED_PROXY_MODE=static` and `TRUSTED_PROXY_NETWORKS` to the verified CIDR list **or** document an evidence-based decision to remain on `none` if and only if the app is not behind a forwarding hop that breaks client identity (must be proven — default assumption after Part 3.1 is that a real edge **does** forward).
- Verify forwarded `X-Forwarded-Proto` is honored for HSTS only via trusted peers.
- Untrusted clients must not spoof IP or scheme.

---

## 12. Environment-variable validation

Minimum production set (names from `backend/app/core/config.py` + Part 2 practice):

| Variable | Production expectation |
|---|---|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `SECRET_KEY` | ≥32 chars, non-placeholder |
| `DATABASE_URL` | Railway Postgres async URL; TLS policy per §9 |
| `REDIS_URL` | Production Redis |
| `CORS_ORIGINS` | JSON list of https Vercel origins |
| `FRONTEND_URL` | Canonical https frontend URL |
| `TRUSTED_PROXY_MODE` | `static` once CIDRs known (or proven `none`) |
| `TRUSTED_PROXY_NETWORKS` | Verified CIDRs when mode is `static` |
| `RATE_LIMIT_ENABLED` | `true` |
| `RATE_LIMIT_PER_MINUTE` | Explicit value |
| `SENTRY_DSN` | Set if observability required (Part 2 used it) |

Repository hygiene:

- Extend `.env.example` with commented `TRUSTED_PROXY_*` documentation (no secrets).
- Never commit live values.

Boot requirement: application starts successfully with `validate_production_config()` raising no errors.

---

## 13. Health and readiness verification

| Probe | Path | Must prove |
|---|---|---|
| Liveness | `GET {API}/api/v1/health` | `success` + `environment=production` |
| Readiness | `GET {API}/api/v1/ready` | DB `SELECT 1` succeeds |

Wire these URLs into Railway health checks if supported. Document that Redis is not part of `/ready` today.

---

## 14. Authentication production smoke testing

Re-run against **production** after proxy/CORS/env changes (do not rely solely on Part 2 dated evidence):

1. Register (or controlled test tenant strategy)
2. Login
3. `GET /auth/me`
4. Refresh rotation
5. Logout / session revocation
6. Confirm audit row / security metadata for login where DB access allows (IP should reflect real client after proxy trust)

Capture HTTP status codes, response envelope success flags, and timestamps. Prefer a dedicated test account.

---

## 15. Logging and observability verification

1. Structured request logs include `request_id`.
2. Forced or naturally occurring 500 path shows useful production diagnostics without leaking secrets (OBS-001 code path).
3. Security headers present on API responses (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; HSTS when HTTPS via trusted proto).
4. Sentry receives a test event (or documented waiver with risk acceptance).

---

## 16. Rollback and recovery requirements

Document and dry-run where safe:

1. Revert Railway env var set to last known good + redeploy.
2. Alembic downgrade policy (when allowed / forbidden).
3. Vercel redeploy previous frontend deployment.
4. Incident steps if rate limiting fails open (Redis outage) or fails closed incorrectly.

---

## 17. Documentation requirements

| Deliverable | Location |
|---|---|
| This governing roadmap | `docs/product/Part-03.2-Deployment-Configuration-and-Production-Verification-Roadmap.md` |
| Product index entry | `docs/product/README.md` |
| Deployment runbook (URLs, vars list without secrets, probe commands) | `docs/product/` or `docs/reports/Part-03.2/` when authored |
| Part 3.2 verification report | `docs/reports/Part-03.2/` (create with evidence; not before) |
| Superseding statement vs Part 3.1 NOT READY matrix | Inside verification report |

---

## 18. Definition of Done

Part 3.2 is **Done** only when all are true:

1. Trusted-proxy configuration is either correctly set and proven, or an evidence-backed `none` decision is recorded with proof that client identity is not collapsed.
2. Production boot passes `validate_production_config()`.
3. Production Alembic head matches repository head.
4. Redis-backed rate limiting is effective per client in production topology.
5. CORS + Vercel auth path re-verified.
6. Health + ready probes verified on production URLs.
7. Auth smoke suite re-executed with dated evidence.
8. Logging / headers / Sentry spot checks recorded.
9. Rollback runbook published.
10. Part 3.2 verification report committed under `docs/reports/Part-03.2/`.
11. Part 3.1 readiness items Deployment Configuration / Production Deployment / Production Traffic are explicitly reassessed in that report (not assumed).
12. Linear corrections for WAL-18 / WAL-28 (Appendix A) applied only after separate approval.

---

## 19. Validation commands and evidence requirements

Commands are templates — run against production credentials via secure operator environment, never paste secrets into git.

```bash
# API probes (set API_BASE to production HTTPS API origin)
curl -sS "$API_BASE/api/v1/health" | jq .
curl -sS "$API_BASE/api/v1/ready" | jq .

# CORS preflight (set VERCEL_ORIGIN)
curl -sS -D- -o /dev/null -X OPTIONS "$API_BASE/api/v1/auth/login" \
  -H "Origin: $VERCEL_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"

# Migrations (production DATABASE_URL injected securely)
cd backend && alembic current && alembic heads

# Local regression still required after any code touch
cd backend && ruff check . && mypy app && pytest -q
```

**Evidence pack (minimum):** dated screenshots or redacted log excerpts, curl transcripts, `alembic current` output, Railway variable *names* checklist (not values), proxy CIDR decision record, auth smoke results table.

---

## 20. Proposed Linear hierarchy

**Do not create these issues until this roadmap is approved.**  
Parent umbrella (new): **3.2 — Deployment Configuration & Production Verification**  
Project: NexusOS · Milestone (approved): **Part 03.2 — Deployment Configuration & Production Verification** — a **new** Linear milestone (do not attach under the completed Part 03 milestone).  
Rejected counts from Proposal A/B do not apply.  
**Count (authoritative):** 1 umbrella + 14 mains + 50 sub-issues = **65** Linear issues.

### Status vocabulary

| Status label in this doc | Meaning |
|---|---|
| Already implemented and verified | Code/docs proven; still may need production re-check if noted |
| Implemented but not fully verified | Exists (often Part 2 era) but lacks post–3.1 production evidence |
| Missing configuration | Code ready; operator values absent |
| Missing documentation | Behavior exists; repo docs incomplete |
| Not started | No evidence of work |
| Blocked | Waiting on another issue / external CIDR knowledge |

### Count summary

| Layer | Count |
|---|---|
| Umbrella issue | 1 |
| Main technical issues | 14 |
| Sub-issues | 50 |
| **Total proposed new Linear issues** | **65** |

---

### 3.2 — Umbrella

| Field | Value |
|---|---|
| **Title** | 3.2 — Deployment Configuration & Production Verification |
| **Objective** | Configure and verify production topology so Part 3.1 security controls operate correctly at the Railway/Vercel edge. |
| **Scope** | §§4–18 of this document |
| **Acceptance criteria** | Definition of Done §18 |
| **Required evidence** | Part 3.2 verification report |
| **Dependencies** | Part 3.1 code complete (`f521d38` / `5f2a66b`) |
| **Suggested labels** | `backend`, `security`, `Testing&Verification` |
| **Initial status** | **Not started** (roadmap authored; work not executed) |

---

### 3.2.1 — Production Environment Inventory

| Field | Value |
|---|---|
| **Objective** | Record live Railway/Vercel/Postgres/Redis identities and public URLs without committing secrets. |
| **Scope** | Service names, regions, public API URL, Vercel origin, Redis presence |
| **Acceptance criteria** | Inventory table committed to runbook (redacted) |
| **Required evidence** | Runbook section |
| **Dependencies** | None |
| **Suggested labels** | `Documentation` |
| **Initial status** | **Not started** |

**Sub-issues**

| Title | Initial status | Acceptance / evidence |
|---|---|---|
| Document Railway API service identity | Not started | Service name + public HTTPS API base in runbook |
| Document Vercel project + production origin | Not started | Exact `https://…` origin string |
| Document Postgres + Redis service linkage | Not started | Confirm both attached to API; no secrets |

---

### 3.2.2 — Trusted Proxy & Edge Topology Configuration

| Field | Value |
|---|---|
| **Objective** | Close Part 3.1 Deployment Configuration NOT READY by configuring verified proxy trust. |
| **Scope** | `TRUSTED_PROXY_MODE`, `TRUSTED_PROXY_NETWORKS`, empirical peer verification, rate-limit identity proof |
| **Acceptance criteria** | Documented CIDRs + production proof of per-client limiting / non-spoofable scheme |
| **Required evidence** | CIDR decision record; curl/log proof; optional load-test notes |
| **Dependencies** | 3.2.1 |
| **Suggested labels** | `security` |
| **Initial status** | **Blocked** / **Missing configuration** (defaults `none` / `[]` per Part 3.1) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Identify Railway edge `request.client.host` observation method | Not started |
| Obtain verified proxy/edge CIDR list (provider docs or empirical) | Blocked (needs live access) |
| Set `TRUSTED_PROXY_MODE` + `TRUSTED_PROXY_NETWORKS` in Railway | Missing configuration |
| Verify untrusted clients cannot spoof IP/scheme | Not started |
| Prove per-client rate-limit budgets behind the edge | Blocked on proxy config |

---

### 3.2.3 — Railway Backend Production Configuration

| Field | Value |
|---|---|
| **Objective** | Ensure API service runs with production security boot settings. |
| **Scope** | `ENVIRONMENT`, `DEBUG`, `SECRET_KEY`, redeploy |
| **Acceptance criteria** | Boot logs show `environment=production`; validator passes |
| **Required evidence** | Redacted boot log; variable name checklist |
| **Dependencies** | 3.2.2 (for complete security posture), 3.2.7 |
| **Suggested labels** | `backend` |
| **Initial status** | **Implemented but not fully verified** (Part 2 deploy; post–3.1 boot not evidenced) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Confirm `ENVIRONMENT=production` on Railway | Implemented but not fully verified |
| Confirm `DEBUG=false` and strong `SECRET_KEY` | Implemented but not fully verified |
| Redeploy and capture boot log after Part 3.1 | Not started |
| Confirm no secrets committed in git | Already implemented and verified (process) — re-check at close |

---

### 3.2.4 — PostgreSQL Production Migration Verification

| Field | Value |
|---|---|
| **Objective** | Prove production schema is at Alembic head including Part 3.1 migrations. |
| **Scope** | `alembic current/heads`; Part 3.1 revisions; TLS/role/backup posture |
| **Acceptance criteria** | Head match + Deferred §1 gaps closed or explicitly risk-accepted with owner |
| **Required evidence** | Command transcripts; role diagram |
| **Dependencies** | 3.2.1 |
| **Suggested labels** | `backend` |
| **Initial status** | **Implemented but not fully verified** (Part 2 migrated earlier schema; Part 3.1 head on prod unknown in repo) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Run `alembic current` / `heads` on production DB | Not started |
| Confirm Part 3.1 migrations applied | Not started |
| Evaluate TLS (`sslmode`) on production `DATABASE_URL` | Missing configuration (unknown) |
| Document migrator vs app role split (Deferred §1) | Missing configuration / documentation |
| Record backup + restore-drill status | Missing documentation |

---

### 3.2.5 — Redis Production Configuration & Rate-Limit Effectiveness

| Field | Value |
|---|---|
| **Objective** | Confirm Redis backs production rate limits effectively. |
| **Scope** | `REDIS_URL`, `RATE_LIMIT_*`, post-proxy effectiveness |
| **Acceptance criteria** | Limits enforce per client after 3.2.2 |
| **Required evidence** | 429 transcript; Redis ping from app |
| **Dependencies** | 3.2.2, 3.2.3 |
| **Suggested labels** | `backend`, `security` |
| **Initial status** | **Missing configuration** evidence in repo (code ready) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Confirm production `REDIS_URL` attached | Implemented but not fully verified |
| Confirm `RATE_LIMIT_ENABLED=true` | Implemented but not fully verified |
| Document Redis fail-open operational impact | Missing documentation |

---

### 3.2.6 — CORS Production Boundary Re-Verification

| Field | Value |
|---|---|
| **Objective** | Re-verify browser CORS after Part 3.1 and any origin changes. |
| **Scope** | `CORS_ORIGINS`, preflight, credentialed login |
| **Acceptance criteria** | Preflight + login from Vercel origin succeed; no `*` |
| **Required evidence** | curl `-D-` preflight; browser or scripted login |
| **Dependencies** | 3.2.1, 3.2.3, 3.2.11 |
| **Suggested labels** | `security` |
| **Initial status** | **Implemented but not fully verified** (Part 2 era) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Confirm production `CORS_ORIGINS` exact Vercel HTTPS origin | Implemented but not fully verified |
| OPTIONS preflight evidence capture | Not started |
| Reject wildcard / empty origins in production config | Already implemented and verified in code (`validate_production_config`) — confirm live |

---

### 3.2.7 — Environment Variable & Production Config Validation

| Field | Value |
|---|---|
| **Objective** | Make production config complete, documented, and validator-clean. |
| **Scope** | §12 variables; `.env.example` TRUSTED_PROXY docs; boot validation |
| **Acceptance criteria** | Validator passes on prod boot; `.env.example` documents proxy knobs |
| **Required evidence** | Boot log; PR updating `.env.example` |
| **Dependencies** | 3.2.2–3.2.6 |
| **Suggested labels** | `backend`, `Documentation` |
| **Initial status** | **Missing documentation** (`.env.example` gap) + **Not started** live validator proof |

**Sub-issues**

| Title | Initial status |
|---|---|
| Prove `validate_production_config()` on production boot | Not started |
| Document `TRUSTED_PROXY_*` in `.env.example` | Missing documentation |
| Checklist all §12 variables present on Railway | Not started |

---

### 3.2.8 — Health & Readiness Probe Verification

| Field | Value |
|---|---|
| **Objective** | Verify liveness/readiness against production URLs. |
| **Scope** | `/health`, `/ready`; Railway healthcheck wiring |
| **Acceptance criteria** | Both probes green; env shows production |
| **Required evidence** | curl JSON |
| **Dependencies** | 3.2.3, 3.2.4 |
| **Suggested labels** | `Testing&Verification` |
| **Initial status** | **Already implemented** in code; **Not started** for production evidence |

**Sub-issues**

| Title | Initial status |
|---|---|
| Production `/health` check | Not started |
| Production `/ready` check | Not started |
| Document Redis not covered by `/ready` | Missing documentation |

---

### 3.2.9 — Authentication Production Smoke Suite (Post–3.1)

| Field | Value |
|---|---|
| **Objective** | Re-prove auth after security/proxy/CORS changes. |
| **Scope** | register/login/me/refresh/logout + audit metadata spot check |
| **Acceptance criteria** | All steps pass with dated evidence |
| **Required evidence** | Smoke table in verification report |
| **Dependencies** | 3.2.2, 3.2.6, 3.2.8 |
| **Suggested labels** | `Testing&Verification`, `security` |
| **Initial status** | **Implemented but not fully verified** (Part 2; needs post–3.1 redo) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Production register smoke | Implemented but not fully verified |
| Production login smoke | Implemented but not fully verified |
| Production `/auth/me` smoke | Implemented but not fully verified |
| Production refresh smoke | Implemented but not fully verified |
| Production logout / revocation smoke | Implemented but not fully verified |
| Audit IP/UA sanity check after proxy trust | Blocked on 3.2.2 |

---

### 3.2.10 — Logging, Audit & Observability Verification

| Field | Value |
|---|---|
| **Objective** | Confirm production observability still meets Part 3.1 intent. |
| **Scope** | request-ID, exception logs, headers, Sentry |
| **Acceptance criteria** | Spot checks recorded; no secret leakage observed |
| **Required evidence** | Redacted logs; Sentry event id or waiver |
| **Dependencies** | 3.2.3, 3.2.9 |
| **Suggested labels** | `Observability`, `security` |
| **Initial status** | **Implemented but not fully verified** in production post–3.1 |

**Sub-issues**

| Title | Initial status |
|---|---|
| Request-ID present in production logs | Not started |
| Exception logging spot check (no secret leak) | Not started |
| Security headers on production responses | Not started |
| Sentry test event or signed waiver | Implemented but not fully verified |

---

### 3.2.11 — Vercel Frontend Production Configuration

| Field | Value |
|---|---|
| **Objective** | Confirm frontend production config still matches API. |
| **Scope** | SPA rewrite, `VITE_API_BASE_URL`, hard-refresh auth routes |
| **Acceptance criteria** | Auth routes load; API calls succeed |
| **Required evidence** | Browser checks / HAR redacted |
| **Dependencies** | 3.2.1, 3.2.6 |
| **Suggested labels** | `Testing&Verification` |
| **Initial status** | **Implemented but not fully verified** |

**Sub-issues**

| Title | Initial status |
|---|---|
| Confirm SPA rewrites on production | Already implemented and verified (Part 2 / `vercel.json`) — re-check |
| Confirm production `VITE_API_BASE_URL` | Implemented but not fully verified |
| Hard-refresh `/login` (or auth route) works | Implemented but not fully verified |

---

### 3.2.12 — Rollback & Recovery Procedures

| Field | Value |
|---|---|
| **Objective** | Publish operable rollback steps for config and deploy. |
| **Scope** | Env rollback, migration policy, Vercel rollback |
| **Acceptance criteria** | Runbook section reviewed |
| **Required evidence** | Committed runbook |
| **Dependencies** | 3.2.1 |
| **Suggested labels** | `Documentation` |
| **Initial status** | **Not started** |

**Sub-issues**

| Title | Initial status |
|---|---|
| Railway env/revision rollback steps | Not started |
| Alembic downgrade / forward-fix policy | Not started |
| Vercel previous-deployment rollback steps | Not started |

---

### 3.2.13 — Deployment Documentation & Evidence Pack

| Field | Value |
|---|---|
| **Objective** | Leave durable operator docs and evidence template. |
| **Scope** | Runbook, reports folder, product README already listing this roadmap |
| **Acceptance criteria** | `docs/reports/Part-03.2/` verification report committed |
| **Required evidence** | Report file + runbook |
| **Dependencies** | All prior 3.2.x evidence |
| **Suggested labels** | `Documentation` |
| **Initial status** | **Missing documentation** (roadmap exists; runbook/report do not) |

**Sub-issues**

| Title | Initial status |
|---|---|
| Author deployment runbook (redacted) | Not started |
| Author Part 3.2 verification report | Not started |
| Update readiness matrix vs Part 3.1 NOT READY items | Not started |

---

### 3.2.14 — Production Readiness Gate & Sign-off

| Field | Value |
|---|---|
| **Objective** | Formal gate: only then claim production verification for post–3.1 posture. This issue **owns** execution of the §18 Definition of Done checklist (not a separate sub-issue). |
| **Scope** | Walk every §18 Definition of Done item and record evidence; formal sign-off; prepare Linear description corrections (Appendix A) for separate approval; require an explicit “online ≠ verified” statement in the verification report |
| **Acceptance criteria** | Every §18 Definition of Done item is evidenced and checked; gate recorded in the verification report with date/owner; report states that Railway/Vercel being online is not production verification |
| **Required evidence** | Sign-off section with date/owner + completed §18 checklist embedded in the Part 3.2 verification report |
| **Dependencies** | 3.2.2–3.2.13 |
| **Suggested labels** | `Testing&Verification` |
| **Initial status** | **Blocked** |

**Sub-issues**

| Title | Initial status |
|---|---|
| Prepare WAL-18 / WAL-28 correction PR-to-Linear (text only; apply later) | Not started — **do not apply yet** |
| Explicit statement: online ≠ verified | Not started (must appear in report) |

---

## Appendix A — Proposed Linear description corrections (DO NOT APPLY YET)

These rows prepare corrections for inaccurate production claims. **No Linear mutation in this phase.**

| Issue | Current problematic claim (summary) | Proposed correction direction | Repo evidence |
|---|---|---|---|
| **WAL-18** | “Production Verification” checklist items marked complete; final status implies production-verified hardening | Split: keep code/review completion; move production verification to Part 3.2; cite Part 3.1 readiness matrix NOT READY for Deployment Configuration / Production Deployment / Production Traffic | `Part-03.1-Remediation-Re-Review.md` §19–20; follow-up/final verification |
| **WAL-28** | Entire issue framed as production verification completed and “ready to freeze” | Retitle/repurpose as “awaiting Part 3.2 evidence” **or** leave Done but rewrite description to state Part 2-era smoke only and Part 3.1 security deploy config still open — **product owner chooses**; do not silently mark complete | Same reports; absence of `docs/reports/Part-03.2/` verification report |

---

## Appendix B — Consistency checklist (author validation)

| Check | Result |
|---|---|
| Named Part 3.2 matches product decision | Yes — this file |
| Does not use Proposal A/B hierarchies | Yes |
| Trusted-proxy gap preserved as blocker | Yes — 3.2.2 |
| Does not claim production complete because hosts are online | Yes — §2 hard rule |
| Paths cited exist | `config.py`, `health.py`, `auth.py`, `rate_limit.py`, `vercel.json`, `.env.example`, Part 3.1 reports, Part 2 report, `docker-compose.yml` |
| Archive roadmaps not used as authority | Yes |
| Linear changes | None in this phase |

---

## Document control

| Field | Value |
|---|---|
| Created | 2026-07-19 |
| Location | `docs/product/Part-03.2-Deployment-Configuration-and-Production-Verification-Roadmap.md` |
| Supersedes | Unnumbered “Deployment Configuration” stage name in Part 3.1 reports (content of that stage is preserved and expanded here) |
| Count correction | 2026-07-19 — removed redundant sub-issue “Complete §18 Definition of Done checklist”; §18 checklist owned by 3.2.14; totals fixed at 1+14+50=65 |
| Milestone decision | New Linear milestone: Part 03.2 — Deployment Configuration & Production Verification (not created yet) |
| Next action | Create Linear milestone + 65 issues per §20 only after explicit creation approval |
