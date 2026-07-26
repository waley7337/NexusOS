# Part 3.2 — External Security Layer  
## Engineering Implementation Plan

**Status:** CANONICAL — Frozen execution guide  
**Phase:** Part 3.2 implementation (first slice)  
**Part 3.1:** Frozen — do not modify  
**Primary edge:** Cloudflare  
**Architecture principle:** Provider-agnostic app trust boundary (Akamai/other later = config change, not a rewrite)

**Freeze rule:** Do not modify this document unless implementation uncovers new repository facts.  
**Out of scope for this freeze step:** code changes, Linear mutations, commit, push.

---

### 0. Discovery summary (repository truth)

| Fact | State |
|---|---|
| App trust API | `resolve_client_identity()` + `TRUSTED_PROXY_MODE` / `TRUSTED_PROXY_NETWORKS` |
| Defaults | `none` / `[]` — safe but collapses rate-limit identity behind any proxy |
| Provider coupling in code | None (comments only mention Cloudflare/Akamai) |
| `CF-Connecting-IP` mode | Not implemented — optional later |
| Headers / HSTS | App sets baseline headers; HSTS gated on trusted `X-Forwarded-Proto` |
| Auth model | Bearer + localStorage — not cookie sessions |
| Part 3.2 blocker | **3.2.2** Trusted Proxy & Edge Topology still missing real CIDRs |
| `.env.example` | **Documents** `TRUSTED_PROXY_MODE=none`, `TRUSTED_PROXY_NETWORKS=[]`, a commented `static`-mode format example, and warnings against universal `/0` networks and unverified proxy CIDRs |
| Cloudflare in Part 3.2 IDs | Not named in roadmap numbering — this plan is the first execution slice of 3.2.2 (+ related verify work) |

---

### 1. Target architecture

```
Browser / client
    ↓ HTTPS
Cloudflare (TLS terminate, WAF, DDoS, optional bot mgmt)
    ↓ HTTPS (origin pull)
Railway FastAPI origin (private-ish; ideally Cloudflare-only ingress)
    ↓
App: TRUSTED_PROXY_MODE=static + verified Cloudflare (and/or Railway) CIDRs
    ↓
resolve_client_identity() → rate limit / audit / HSTS scheme

Vercel frontend (SPA)
    ↓ cross-origin Bearer calls
API origin hostname (Cloudflare hostname, not raw Railway URL in browsers)
```

**Design rules**

1. Browsers call the **Cloudflare hostname**, never the raw Railway URL (prevents trust/CORS/IP bypass).
2. App remains ignorant of “Cloudflare” as a product — it only trusts **peer CIDRs + standard forwarded headers**.
3. Akamai (future) = different CIDR set / DNS cutover; same app settings shape.
4. Do **not** invent a Cloudflare-specific code path in v1 unless static CIDR trust cannot be proven.

---

### 2. Cloudflare integration (primary)

| Work item | Action |
|---|---|
| Zone / DNS | Point API hostname (and optionally app hostname) at Cloudflare |
| Proxy mode | Orange-cloud proxy enabled for API hostname |
| SSL/TLS | Full (strict) to Railway origin with valid origin cert |
| Origin | Railway public HTTPS URL as origin; restrict direct origin access where possible |
| WAF | Managed ruleset + explicit deny/challenge for known abuse on `/api/v1/auth/*` |
| Rate limiting (edge) | Complementary to Redis app limits — edge for volumetric; app for auth identity |
| Bot Fight / Super Bot | Enable only after measuring false positives on auth flows |
| Logging | Cloudflare Logpush or dashboard logs retained for incident evidence |
| IP reputation | Optional; do not replace app identity resolution |

**Out of v1 unless required**

- Workers rewriting headers
- Cloudflare Access in front of public API
- `CF-Connecting-IP`-only trust mode (prefer standard XFF + CIDR trust first)

---

### 3. Provider-agnostic edge architecture

**App contract (already implemented — configure, don’t redesign):**

| Setting | Production intent |
|---|---|
| `TRUSTED_PROXY_MODE` | `static` |
| `TRUSTED_PROXY_NETWORKS` | Verified edge peer CIDRs only (never `/0`) |

**Abstraction layers**

| Layer | Responsibility | Provider-specific? |
|---|---|---|
| DNS / CDN / WAF / DDoS / TLS edge | Cloudflare now | Yes (ops) |
| Forwarded identity headers | `X-Forwarded-For`, `X-Forwarded-Proto` | Standard |
| Trust decision | Peer IP ∈ configured CIDRs | No |
| Consumers | Rate limit, audit IP, HSTS scheme | No |

**Future Akamai**

1. Cut DNS to Akamai  
2. Replace CIDR list with Akamai published ranges (or empirical peer set)  
3. Re-run spoof + per-client rate-limit proofs  
4. No required app rewrite if header contract stays XFF/XFP

**Optional later code extension (only if needed)**  
If Railway inserts an extra hop that makes Cloudflare ranges insufficient as *peer* CIDRs, document the real peer first; only then consider trusting an additional hop or a dedicated header mode. Do not add `CF-Connecting-IP` until static CIDR trust is proven insufficient.

---

### 4. Trusted proxy configuration (closes 3.2.2)

**Sequence (mandatory order)**

1. **Inventory** (3.2.1): API hostname, Railway origin URL, Vercel origin, Redis attached.  
2. **Observe peer**: From production logs or a temporary safe diagnostic, record `request.client.host` as seen by FastAPI when traffic arrives via Cloudflare.  
3. **Build CIDR set**: Prefer provider-documented Cloudflare IP ranges that match observed peers; do not guess.  
4. **Account for Railway**: If peer is Railway’s proxy/mesh rather than Cloudflare, trust that peer set and confirm Cloudflare still appears correctly in XFF.  
5. **Set Railway vars** (not git):  
   - `TRUSTED_PROXY_MODE=static`  
   - `TRUSTED_PROXY_NETWORKS=[...]` JSON list of CIDRs  
6. **Redeploy** and prove:  
   - Untrusted direct client cannot spoof XFF/XFP  
   - Two distinct clients get independent Redis rate-limit budgets  
   - Audit `ip_address` reflects real client, not shared edge IP  
7. **Document** CIDR decision record in Part 3.2 runbook/evidence (redacted).

**Hard constraints (already coded)**

- Reject `/0` (NEW-001)  
- Production refuse `static` + empty networks  
- Defaults stay fail-safe until deliberately switched

---

### 5. WAF responsibilities

| Concern | Edge (Cloudflare) | App (NexusOS) |
|---|---|---|
| OWASP / common exploits | Managed WAF rules | Not primary |
| Auth brute-force volume | Edge rate rules / bot | Redis fixed-window on auth routes |
| Spoofed client IP | Edge sends true client in XFF; app trusts only after CIDR gate | `client_ip.py` |
| Business authz / tenant | — | App only |
| Payload validation | Basic body size / protocol | Pydantic / domain rules |

**Rule:** Edge does not replace Part 3.1 controls; it reduces junk traffic and volumetric abuse before Railway.

---

### 6. DDoS protection

| Layer | Plan |
|---|---|
| L3/L4 volumetric | Cloudflare proxy (default) |
| L7 floods | Cloudflare rate limiting + WAF |
| App saturation | Keep Railway health checks on `/api/v1/health`; fail-open Redis rate limit remains accepted — document operational impact |
| Origin shield | Prefer Cloudflare-only origin access (firewall / Railway private networking if available) |

Acceptance: public API hostname remains responsive under elevated noise; origin not directly floodable from the open internet without Cloudflare.

---

### 7. TLS / HTTPS termination

| Hop | TLS |
|---|---|
| Client → Cloudflare | Cloudflare edge cert (HTTPS) |
| Cloudflare → Railway | Full (strict); valid origin certificate |
| App HSTS | Emitted only when `resolve_client_identity().scheme == "https"` via trusted proto |

**Do not** enable app HSTS based on untrusted client-supplied `X-Forwarded-Proto` (already fixed in Part 3.1).  
After proxy trust is correct, verify HSTS appears on API responses for HTTPS clients and does **not** appear when spoofed by untrusted peers.

---

### 8. Real client IP forwarding

| Step | Requirement |
|---|---|
| Cloudflare | Restore visitor IP into `X-Forwarded-For` (default with proxy) |
| App | `TRUSTED_PROXY_MODE=static` + correct peer CIDRs |
| Consumers | Rate-limit key + audit IP use `resolved_ip` |
| Proof | Two clients → two Redis keys; forged XFF from untrusted peer ignored |

If identity remains collapsed after Cloudflare: stop and re-analyze hop chain before any code change.

---

### 9. Security headers interaction

| Header / control | Owner | Interaction |
|---|---|---|
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control` | App middleware | Keep; optional Cloudflare transform only if no conflict |
| HSTS | App (trusted scheme) | Prefer single source of truth — either app **or** Cloudflare, not contradictory max-age |
| CSP | Frontend / edge (JSON API has no blanket CSP today) | If added, put on Vercel/Cloudflare for HTML, not blindly on API JSON |
| CORS | App `CORSMiddleware` (outermost) | Must list exact Vercel `https://` origin; browsers must hit Cloudflare API host |

**Plan default:** Leave app baseline headers; use Cloudflare for WAF/DDoS/TLS; avoid duplicate/conflicting HSTS unless ops chooses edge-only HSTS and documents app disablement (code change only if chosen).

---

### 10. Railway deployment implications

| Item | Action |
|---|---|
| Public URL | Keep origin for Cloudflare; discourage browser use of raw Railway URL |
| Env vars | Set `TRUSTED_PROXY_*`, confirm `ENVIRONMENT=production`, `CORS_ORIGINS`, `FRONTEND_URL`, Redis, etc. |
| Healthcheck | Point at `/api/v1/health` (and readiness separately) |
| Redeploy | Required after proxy var changes |
| Logs | Capture `request_id`, resolved client IP samples (redacted) for evidence |
| Secrets | Never commit Cloudflare tokens / Railway values |

Maps to roadmap: **3.2.2**, **3.2.3**, **3.2.7**, **3.2.8**.

---

### 11. Vercel frontend implications

| Item | Action |
|---|---|
| `VITE_API_BASE_URL` | Production API = Cloudflare API hostname + `/api/v1` |
| SPA rewrites | Existing `vercel.json` — re-verify hard refresh on auth routes |
| CORS | Backend `CORS_ORIGINS` must match exact Vercel origin |
| Auth | Bearer/localStorage unchanged — no cookie SameSite work in v1 |
| Optional | Put marketing/app hostname on Cloudflare later; not required for API edge v1 |

Maps to: **3.2.6**, **3.2.11**, **3.2.9**.

---

### 12. Logging and observability

| Signal | Where | Post-edge check |
|---|---|---|
| `request_id` | App structlog | Present in Railway logs |
| Client IP | Audit + rate-limit key | Real client, not single edge IP |
| Exceptions | App OBS-001 path | Still useful; no secrets |
| Edge events | Cloudflare | WAF blocks, rate challenges, origin errors |
| Sentry | Optional `SENTRY_DSN` | Re-verify after hostname cutover |

Evidence for Part 3.2 verification report: redacted Railway log lines + Cloudflare event samples + auth smoke table.

---

### 13. Testing strategy

**A. Local / CI (no Cloudflare required)**  
Existing Part 3.1 suite remains gate for any code touch:
- `backend/tests/security/test_client_ip.py`
- `test_trusted_proxy_http.py`
- `test_trusted_proxy_config.py`
- rate limit / headers / auth tests

**B. Staging / production topology tests (required for this slice)**

| Test | Pass criteria |
|---|---|
| Peer observation | Documented `request.client.host` via Cloudflare path |
| Spoof XFF | Untrusted caller cannot change resolved IP / HSTS |
| Per-client RL | Two clients → independent 429 budgets |
| CORS preflight | Vercel origin → Cloudflare API host succeeds |
| Auth smoke | register/login/me/refresh/logout via Cloudflare hostname |
| Health | `/api/v1/health`, `/api/v1/ready` via Cloudflare hostname |
| Direct origin | Document residual risk if Railway URL still public |

**C. No app code in v1 if config-only succeeds**  
If hop chain forces a code change, add regression tests first; keep provider-agnostic.

---

### 14. Rollback strategy

| Failure | Rollback |
|---|---|
| Bad CIDR list / boot fail | Revert Railway `TRUSTED_PROXY_*` to last known good (`none`/prior list) + redeploy |
| WAF false positives on auth | Disable/loosen specific Cloudflare rule; keep proxy |
| DNS / TLS outage | Cloudflare DNS rollback to prior origin-only (accept temporary loss of edge protections) |
| CORS breakage | Restore prior `CORS_ORIGINS` / `VITE_API_BASE_URL` |
| Rate-limit identity wrong | Immediate revert to `TRUSTED_PROXY_MODE=none` (safe collapse) while re-analyzing CIDRs |

Document steps in Part 3.2 runbook (**3.2.12**).

---

### 15. Acceptance criteria (this slice)

Done for **External Security Layer v1** only when all are true:

1. API production hostname terminates TLS at Cloudflare and proxies to Railway.  
2. `TRUSTED_PROXY_MODE=static` with verified non-universal CIDRs set in Railway.  
3. Spoofing proof: untrusted XFF/XFP ignored.  
4. Per-client Redis rate limiting proven behind Cloudflare.  
5. Audit IP reflects distinct clients.  
6. HSTS/scheme trust still correct post-cutover.  
7. Vercel → Cloudflare API CORS + auth smoke pass.  
8. Health probes pass on Cloudflare hostname.  
9. CIDR decision record + redacted evidence captured for Part 3.2.  
10. No claim of full Part 3.2 DoD until remaining 3.2.x items (DB roles/TLS/backups, full verification report, etc.) complete.  
11. Online Cloudflare/Railway ≠ automatic “production verified” for entire Part 3.2.

---

### 16. Required documentation updates (when implementing)

| Deliverable | Location |
|---|---|
| CIDR decision record + hop diagram | Part 3.2 runbook / `docs/reports/Part-03.2/` |
| `.env.example` commented `TRUSTED_PROXY_*` | **COMPLETE** — Repo root (no secrets); safe defaults `none`/`[]`, commented `static` example, `/0` and unverified-CIDR warnings |
| Cloudflare ops notes (WAF profile, SSL mode, hostname) | Runbook (redacted) |
| Verification evidence | `docs/reports/Part-03.2/` verification report (when evidence exists) |
| Part 3.2 readiness reassessment | Inside verification report vs Part 3.1 NOT READY matrix |

**Do not** edit Part 3.1 frozen docs.

---

### 17. Recommended execution order

```
0. Complete §19 Operations Readiness Checklist (all items)
1. Inventory live hosts (3.2.1)
2. Stand up Cloudflare in front of API (DNS + Full Strict + baseline WAF)
3. Observe Railway peer IP via Cloudflare path
4. Configure TRUSTED_PROXY_* (3.2.2)
5. Prove spoof resistance + per-client rate limits
6. Point Vercel API base at Cloudflare hostname; re-verify CORS/auth (3.2.6 / 3.2.9 / 3.2.11)
7. Capture evidence; update runbook (`.env.example` TRUSTED_PROXY documentation already complete)
8. Only then continue broader Part 3.2 (Redis effectiveness sign-off, probes, rollback docs, full gate)
```

**Code changes:** none expected for v1.  
**Config / DNS / WAF / docs / evidence:** expected.  
**Linear:** use existing Part 3.2 issues (especially **3.2.2**); do not invent a parallel hierarchy in this plan step.

---

### 18. Explicit non-goals (v1)

- Rewriting `client_ip.py` for Cloudflare-only headers  
- Implementing Akamai now  
- Changing Part 3.1 security code for cosmetics  
- Claiming Part 3.2 complete from Cloudflare online alone  
- Storing Cloudflare/Railway secrets in git  
- Putting WAF in charge of tenant authorization  

---

### 19. Operations Readiness Checklist

Complete **every** item below before any production DNS, Cloudflare, or Railway infrastructure change. Mark each item only when verified.

| # | Prerequisite | Verified |
|---|---|---|
| 1 | Cloudflare account access confirmed (zone DNS + WAF + SSL settings editable) | ☐ |
| 2 | Railway production project/service access confirmed | ☐ |
| 3 | Railway production environment backed up / current revision noted (redeploy target known) | ☐ |
| 4 | PostgreSQL backup available (or provider snapshot confirmed restorable) | ☐ |
| 5 | Current Railway environment variable *names* documented (no secret values in git) | ☐ |
| 6 | Current DNS configuration recorded (API hostname records, TTL, current targets) | ☐ |
| 7 | Rollback DNS target documented (pre-Cloudflare / origin-direct restore path) | ☐ |
| 8 | Cloudflare SSL mode selected (**Full (strict)** for v1) and origin cert validity confirmed | ☐ |
| 9 | Railway health endpoint verified live: `GET /api/v1/health` (and `/api/v1/ready` noted) | ☐ |
| 10 | Vercel production deployment verified (SPA loads; current `VITE_API_BASE_URL` recorded) | ☐ |
| 11 | Monitoring/log access confirmed (Railway logs + Cloudflare analytics/events; Sentry if used) | ☐ |
| 12 | Maintenance window selected if required (or explicit decision: change without window) | ☐ |
| 13 | Rollback procedure reviewed (§14) — DNS, `TRUSTED_PROXY_*`, CORS/API base, WAF | ☐ |
| 14 | Operator on-call / owner assigned for the change window | ☐ |

**Gate:** Do not proceed to §17 step 2 (Cloudflare cutover) until all rows are checked.

---

## Document control

| Field | Value |
|---|---|
| **Status** | **CANONICAL — FROZEN** |
| Location | `docs/product/Part-03.2-External-Security-Layer-Implementation-Plan.md` |
| Approved | 2026-07-19 |
| Frozen | 2026-07-19 (includes §19 Operations Readiness Checklist) |
| Governs | First Part 3.2 implementation slice — External Security Layer |
| Downstream roadmap | `docs/product/Part-03.2-Deployment-Configuration-and-Production-Verification-Roadmap.md` |
| Modification rule | Only if implementation uncovers new repository facts |
| Next action | Execute §19 checklist, then §17 order — no further plan edits first |
