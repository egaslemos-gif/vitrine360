# ADR-EXPERIENCE-005 — Dedicated Experience Origin + Package Serving

**Status:** Accepted (origin + serving; no Player wire) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-05  
**Depends on:** ADR-EXPERIENCE-001 … 004  
**Related:** `docs/RUNTIME-EXPERIENCE-05-ORIGIN-SERVING.md`

---

## Context

EXPERIENCE-04 selected a **Dedicated Experience Origin** and forbade same-origin privileged sandbox defaults. Before an iframe host or bridge exists, packages still need a **safe serving surface**: deterministic URLs, fail-closed admission, and security headers — without elevating package bytes to privileged app code.

---

## Problem

How do we serve Experience Package members from a dedicated origin without implementing Player execution, bridges, or database migrations?

---

## Decision

1. Introduce canonical paths `/x/{tenantId}/{experienceId}/{version}/…`.  
2. Guard Experience hosts via Next.js 16 `proxy.ts` so only `/x/*` is reachable on that origin.  
3. Serve members only when registry-style record is **VALID + PUBLISHED** and tenant matches.  
4. Attach deny-by-default CSP / Permissions-Policy on responses.  
5. Keep an **in-process package store** (no Drizzle migration) for this phase.  
6. **Do not** implement iframe, bridge, HTML_APP, or playback integration.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Serve Experiences from `/api/media` on app origin | Collapses origin boundary; cookie risk |
| Skip host guard until DNS exists | Easy to accidentally expose admin on future Experience host |
| Persist packages in SQLite now | Couples migration before upload/UX design |
| Embed iframe in Player now | Violates phased boundary (EXPERIENCE-06+) |

---

## Consequences

### Positive

- Clear URL + header contract for EXPERIENCE-06 iframe `src`.  
- Tenant-safe serve admission without Player wiring.

### Risks

- In-memory store is process-local (lost on cold start) — acceptable until blob persistence.  
- Without DNS, local `/x` on app host does not provide cookie isolation — documented.

### Deferred

- DNS/TLS for `experience.*`  
- Object-storage persistence  
- Signed URL / device-scoped serve tokens  
- iframe host + bridge  

---

## References

- `docs/RUNTIME-EXPERIENCE-05-ORIGIN-SERVING.md`  
- `npm run test:runtime-experience-05`
