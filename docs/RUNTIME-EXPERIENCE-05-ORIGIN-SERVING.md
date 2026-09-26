# Vitrine360 — RUNTIME-EXPERIENCE-05  
# Dedicated Experience Origin + Package Serving

**Date:** 2026-09-23  
**Status:** ORIGIN + SERVING VALIDATED (no Player wire)  
**Depends on:** EXPERIENCE-01 … 04  
**ADR:** [ADR-EXPERIENCE-005](./adr/ADR-EXPERIENCE-005.md)

**Not claimed:** iframe host · bridge · Player integration · HTML_APP · DNS provisioning · PRODUCTION / PHYSICAL VALIDATED

---

## 0. Purpose

Provision the **serving surface** for Experience Packages on a **dedicated Experience Origin**, without wiring the Player or executing packages as privileged application code.

```text
PACKAGE ≠ TRUST
VALID ≠ AUTHORIZED
AUTHORIZED ≠ EXECUTABLE
EXECUTABLE ≠ PRIVILEGED
```

Server **reads and returns bytes**. The server does **not** evaluate Experience HTML/JS/CSS.

---

## 1. Scope

### In scope

- Dedicated origin configuration (`EXPERIENCE_ORIGIN`)  
- Host guard (`proxy.ts`) — Experience host only serves `/x/*`  
- Canonical serve URL/path scheme  
- Fail-closed serve admission (tenant + VALID + PUBLISHED)  
- Package member resolution (entrypoint + assets)  
- Security headers (CSP, Permissions-Policy, nosniff, …)  
- In-process package store (no Drizzle migration)  
- Docs / ADR / tests  

### Out of scope (forbidden)

| Item | Status |
|------|--------|
| Player iframe / sandbox host | Forbidden |
| postMessage bridge | Forbidden |
| HTML_APP / CONTENT_TYPES change | Forbidden |
| Playback / scheduler / Device Runtime changes | Forbidden |
| Experience DB tables / migrations | Forbidden |
| DNS / TLS certificate provisioning | Ops deferred |

---

## 2. Origin model

| Env | Role |
|-----|------|
| `EXPERIENCE_ORIGIN` | Absolute origin, e.g. `https://experience.example.com` |
| `EXPERIENCE_ORIGIN_HOSTS` | Optional extra hostnames (comma-separated) |
| `NEXT_PUBLIC_APP_URL` | Privileged app origin (must differ in production) |

**Preferred:** dedicated origin ≠ app origin (EXPERIENCE-04 decision).

Local/dev may omit `EXPERIENCE_ORIGIN` and hit `/x/...` on the app host for tests — production **SHOULD** set a dedicated origin and point DNS at the same deployment.

### Host guard

When `Host` matches Experience origin hosts:

- Allow: `/x/*`  
- Deny: `/admin`, `/api/*`, `/player`, `/`, etc. → **404**

Implemented in `src/proxy.ts` (Next.js 16 proxy convention).

---

## 3. Serve URL scheme

```text
/x/{tenantId}/{experienceId}/{version}
/x/{tenantId}/{experienceId}/{version}/{assetPath…}
```

| Path | Serves |
|------|--------|
| `/x/…/1.0.0` | Manifest `entrypoint` (typically `index.html`) |
| `/x/…/1.0.0/assets/logo.png` | Declared package member |

Absolute URL when origin configured:

```text
{EXPERIENCE_ORIGIN}/x/{tenantId}/{experienceId}/{version}/…
```

Helpers: `src/domain/experience-origin.ts`.

---

## 4. Serve admission (fail closed)

```text
Store lookup
  → tenantId match
  → experienceId / version match
  → validationState === VALID
  → publicationState === PUBLISHED
  → not BLOCKED
  → manifest snapshot present
  → path normalize (no traversal)
  → member bytes present
  → SERVE / DENY
```

Cross-tenant path spoofing → **403** `EXPERIENCE_BLOCKED`.

Serving a package **still does not** mean Player execution is authorized.

---

## 5. Package store

`src/services/experience-package-store.ts`

- In-process Map (no SQLite/Drizzle table in this phase)  
- `putExperiencePackage` revalidates with EXPERIENCE-03 validator by default  
- Requires `validationState: VALID` + `manifestSnapshot`  

Future phases may persist blobs to R2/object storage; API shape stays locator-based.

---

## 6. Security headers (served responses)

Every successful serve includes conceptual Experience CSP (deny-by-default network):

- `Content-Security-Policy`: `default-src 'none'; script-src 'self'; …; connect-src 'none'; object-src 'none'; …`  
- `Permissions-Policy`: camera/microphone/geolocation/… disabled  
- `X-Content-Type-Options: nosniff`  
- `Referrer-Policy: no-referrer`  
- `X-Vitrine360-Experience-Package-Sha256`  
- Documents also get `X-Frame-Options: SAMEORIGIN`  

No `Set-Cookie`. No bearer tokens embedded in responses.

CSP alone ≠ isolation; dedicated origin remains the primary cookie/storage boundary.

---

## 7. Implementation map

| Module | Role |
|--------|------|
| `src/domain/experience-origin.ts` | Origin config, URL/path helpers, host allow checks |
| `src/domain/experience-serving.ts` | Admission, member resolve, headers |
| `src/services/experience-package-store.ts` | In-memory store |
| `src/app/x/.../[[...path]]/route.ts` | GET bytes |
| `src/proxy.ts` | Experience-origin path guard |

---

## 8. Threat delta

| Threat | EXPERIENCE-05 control |
|--------|------------------------|
| T4 Cookie theft | Dedicated origin host guard separates app cookies when DNS set |
| T5/T14 Tenant exfil | Serve admission tenant match |
| T6 Network | CSP `connect-src 'none'` on served docs |
| T7 Top navigation | Not framing Player yet; CSP `frame-ancestors 'self'` |
| T10 Malicious package | Only VALID+PUBLISHED served; path normalize |

Player isolation (iframe/sandbox/bridge) remains EXPERIENCE-06+.

---

## 9. Non-goals confirmed

- No iframe executor  
- No postMessage bridge  
- No HTML_APP enum  
- No playback integration  
- No Experience migrations  

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-005.md`  
- Checklist: `docs/evidence/runtime-experience-05/ORIGIN-SERVING-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-05`
