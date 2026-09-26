# PLATFORM-IDENTITY-06A — Platform Tenants API Security & Authorization Audit

**Date:** 2026-09-23  
**Status:** **AUDIT VALIDATED** (design / security gate only — **no production code changes**)  
**Depends on:** PI-04 VALIDATED · PI-05A/B VALIDATED  
**ADR:** `docs/adr/ADR-PLATFORM-IDENTITY-006A.md`  
**Evidence:** `docs/evidence/platform-identity-06a/`

---

## Absolute rule (this phase)

**Zero** production changes to schema, JWT, session, RBAC catalogues, Platform UI, Device, Experience, Billing.

PI-06A audits the existing Platform Tenants API and defines the **safe expansion contract** for PI-06B (API hardening / read expansion) and later UI (console).

---

## 1. Objective

Audit `GET /api/platform/tenants` against dual-axis authorization and multi-tenant isolation.

Current permission in catalogue:

```text
platform.tenants.read
```

---

## 2. Surface under audit

| Item | Location |
|------|----------|
| Route | `src/app/api/platform/tenants/route.ts` |
| Gate | `requirePlatformPermission("platform.tenants.read")` |
| Flag | `PLATFORM_IDENTITY_ENABLED` (OFF → 404) |
| Data | `listTenantsMetadata()` → id, name, slug, status, createdAt |
| Methods | **GET only** (no POST/PATCH/DELETE) |

No other `/api/platform/**` routes exist.

---

## 3. Authorization flow (as-built)

```text
Request
  → flag OFF? 404
  → getAuthContext() via cookie JWT (verify signature)
  → resolve ACTIVE platform_assignments (DB)
  → map PLATFORM_ROLE_PERMISSIONS
  → require platform.tenants.read
  → listTenantsMetadata()
  → return metadata JSON
```

| Check | Result | Notes |
|-------|--------|-------|
| Tenant `requireSession` used? | **No** | Correct — platform axis independent |
| JWT role trusted as platform authority? | **No** | DB assignment revalidated |
| Flag OFF conceals surface? | **Yes** | 404 Not found |
| Unauthenticated | **401** | via `AuthError` |
| Authenticated, no platform assignment | **403** | including tenant SUPER_ADMIN |
| ACTIVE PLATFORM_SUPER_ADMIN + flag ON | **200** | metadata only |
| Response includes content/media/playlists? | **No** | Field allowlist |

---

## 4. Security findings

### PASS (acceptable for current stub)

| ID | Finding |
|----|---------|
| T-01 | Deny-by-default platform permission |
| T-02 | Flag OFF → 404 (no capability advertisement) |
| T-03 | Metadata field allowlist (no nested resources) |
| T-04 | No mutation verbs on route |
| T-05 | `platform.*` absent from tenant `PERMISSIONS` |
| T-06 | Device Bearer / Experience not coupled to this route |
| T-07 | JWT unchanged; no platform claims required |
| T-08 | SUPER_ADMIN membership alone cannot pass gate (proven PI-05B) |

### PARTIAL (hygiene / PI-06B backlog — not PI-06A blockers)

| ID | Finding | Risk | Recommended PI-06B action |
|----|---------|------|---------------------------|
| T-09 | `listTenantsMetadata` has **no internal authz** | Misuse if called from tenant code | Document + optionally assert caller, or move under `services/platform-tenants.ts` |
| T-10 | No rate limit on platform list | Enumeration / DoS at scale | `enforceRateLimit` bucket `platform-tenants` |
| T-11 | No audit log of platform reads | Weak forensics | Optional `activity_logs` with `resource=platform.tenants` |
| T-12 | No pagination | Large tenant tables | `limit`/`cursor` (cap max page size) |
| T-13 | `tenants.status` semantics still residual (PI-03) | Ops confusion if abused later | Document allowed values before `tenants.suspend` |
| T-14 | Login still requires tenant membership path | Pure platform-only user hard to obtain cookie | Accept for now; bootstrap users keep a home membership OR later platform login path |
| T-15 | No HTTP integration test hitting route with cookie | Suite is mostly unit/static | Add route-level test in PI-06B |

### FAIL

None for the **current read-only stub** scope.

### NOT A SECURITY BLOCKER

Expanding to UI (console) or `manage`/`suspend` **is blocked until** explicit permissions and audits land — but that is scope control, not a defect in today’s GET.

---

## 5. Data exposure assessment

| Field | Exposed | Acceptable for `platform.tenants.read`? |
|-------|---------|----------------------------------------|
| `id` | Yes | Yes |
| `name` | Yes | Yes |
| `slug` | Yes | Yes |
| `status` | Yes | Yes (read); mutate needs `suspend` later |
| `createdAt` | Yes | Yes |
| `timezone` | No | Optional later |
| Member emails / passwords | No | Must never |
| Devices / content / media / playlists / experiences | No | Must never under this permission |
| Billing / plans / entitlements | No | PI-08+ |

**Verdict:** Exposure matches Control Plane **directory** semantics, not Tenant Resource plane.

---

## 6. Threat model (focused)

| Threat | Mitigation today | Residual |
|--------|------------------|----------|
| Tenant SUPER_ADMIN lists all tenants | Platform permission required | None material |
| Flag ON without assignment | Empty platform authz → 403 | None |
| JWT `role` forgery | Ignored for platform | None |
| Device token calls platform API | Cookie session required; no Bearer bridge | None |
| Experience iframe calls platform API | No coupling; different origin/path | None |
| IDOR into tenant content via platform route | Route does not load content | Keep forbid nested resource routes |
| Service-layer bypass of gate | `listTenantsMetadata` unprotected | T-09 PARTIAL |
| Mass tenant create via API | No POST | Keep until `platform.tenants.manage` |

---

## 7. Permission roadmap (normative for later phases)

| Permission | API intent | Phase |
|------------|------------|-------|
| `platform.tenants.read` | GET list / GET by id (metadata) | **Exists** · expand in 06B |
| `platform.tenants.manage` | POST create / PATCH rename/slug | **Not before** explicit 06B+/07 decision |
| `platform.tenants.suspend` | PATCH status ACTIVE↔SUSPENDED | After status semantics ADR |
| `platform.support.session.start` | Enter tenant context | **PI-07** |
| Billing / entitlements | — | **PI-08/09** |

**Hard rule:** `platform.tenants.read` must **never** authorize:

- reading playlists, media bytes, device tokens, experience packages  
- mutating tenants  
- starting Support Session  
- impersonating membership  

---

## 8. Target contract for PI-06B (API only — still no UI required)

Recommended additive, still flag-gated:

| Method | Path | Permission | Response |
|--------|------|------------|----------|
| GET | `/api/platform/tenants` | `platform.tenants.read` | Paginated metadata list |
| GET | `/api/platform/tenants/[tenantId]` | `platform.tenants.read` | Single metadata row or 404 |

Optional hardening in same phase:

- rate limit  
- audit log on read (or sampled)  
- relocate list helper to platform-scoped module  
- HTTP cookie tests  

**Out of scope for 06B unless separately approved:**

- POST/PATCH/DELETE tenants  
- Platform Admin UI pages  
- Support Session  
- Changing JWT  

---

## 9. Alignment with prior gates

| Gate | Alignment |
|------|-----------|
| PI-02 | `tenants.read` matches catalogue; manage/suspend deferred |
| PI-03 | Platform routes ≠ tenant routes; JWT thin |
| PI-05A/B | Stub matches AuthContext + flag behaviour |
| Architecture-Future | Control Plane directory; not Resource plane |

---

## 10. Verdict

**PLATFORM-IDENTITY-06A — AUDIT VALIDATED**

The existing Platform Tenants API is **authorization-safe for read-only metadata** under:

`flag ON` ∧ `ACTIVE platform assignment` ∧ `platform.tenants.read`

No critical security blocker prevents planning PI-06B API hardening/expansion.

**Do not** implement manage/suspend/UI in 06A.

### Next gate

**PLATFORM-IDENTITY-06B** — Platform Tenants API hardening (+ optional GET by id / pagination / rate limit / tests), after explicit go-ahead.

Or **PI-06 console UI** only after read API contract is accepted.
