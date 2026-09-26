# ADR-EXPERIENCE-006 — Sandbox Host + CSP / Permissions-Policy Enforcement

**Status:** Accepted (sandbox host; no bridge / no Player wire) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-06  
**Depends on:** ADR-EXPERIENCE-001 … 005  
**Related:** `docs/RUNTIME-EXPERIENCE-06-SANDBOX-HOST.md`

---

## Context

EXPERIENCE-05 serves packages from a dedicated origin with document CSP. EXPERIENCE-04 required a **sandboxed iframe** as defence in depth before any bridge. The Player must not yet treat Experiences as playlist content.

---

## Problem

How do we introduce a sandbox iframe host and enforce CSP / Permissions-Policy for embedding, without opening a postMessage bridge or wiring playback?

---

## Decision

1. Add pure builders for sandbox tokens and iframe `allow` (deny-by-default).  
2. Grant `allow-same-origin` **only** when Experience origin ≠ app origin.  
3. Ship `ExperienceSandboxFrame` that validates `src` and renders a sandboxed iframe with **no** message listeners.  
4. Update package `frame-ancestors` to include the app origin for legitimate embedding.  
5. Keep fullscreen/orientation denied on the iframe; host mediation stays future bridge + POLICY-08A/08B.  
6. Do **not** add HTML_APP, Player integration, or bridge RPC.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Wire iframe into Player now | Skips bridge/admission phases; expands blast radius |
| `allow-same-origin` on app host | Neutralizes sandbox on privileged origin |
| `allow="fullscreen *"` | Bypasses host FullscreenController policy |
| Implement bridge in same phase | Violates EXPERIENCE-07 boundary |

---

## Consequences

### Positive

- Ready embedding surface for EXPERIENCE-07 bridge.  
- Clear deny-by-default token table.

### Risks

- Client needs `NEXT_PUBLIC_EXPERIENCE_ORIGIN` (or `/x` relative src) for host checks.  
- Without dedicated DNS, `allow-same-origin` stays off (correct).

### Deferred

- postMessage bridge  
- Player CONTENT_TYPE / playlist item  
- Dynamic Permissions-Policy from manifest capabilities  

---

## References

- `docs/RUNTIME-EXPERIENCE-06-SANDBOX-HOST.md`  
- `npm run test:runtime-experience-06`
