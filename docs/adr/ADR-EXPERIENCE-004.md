# ADR-EXPERIENCE-004 — Controlled Experience Runtime Security Design

**Status:** Accepted (design / specification only) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-04  
**Depends on:** ADR-EXPERIENCE-001, ADR-EXPERIENCE-002, ADR-EXPERIENCE-003  
**Related:** `docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md`, RUNTIME-POLICY-08A/08B

---

## Context

EXPERIENCE-01..03 established the trust boundary, package contract, and deterministic validator/registry model. No Experience executes yet. Before any iframe, bridge, or Player integration, the product needs a **frozen security design** for how execution would be allowed without elevating third-party HTML/JS to privileged application code.

---

## Problem

How should Vitrine360 structure a future Experience Runtime so that isolation, deny-by-default policies, and admission control are unambiguous — without implementing execution now?

---

## Decision

1. Prefer a **Dedicated Experience Origin** (not same-origin privileged iframe).  
2. Treat sandbox, CSP, and Permissions-Policy as **defence in depth** with **deny-by-default**.  
3. Reject as default: same-origin privileged context with `allow-scripts` + `allow-same-origin`.  
4. Mediate fullscreen/orientation via **host controllers** (POLICY-08A/08B), never free Experience APIs.  
5. Define **postMessage** as the sole controlled bridge, with origin/source/schema allowlisting; do **not** implement it yet.  
6. Require **fail-closed admission control** (registry → tenant → integrity → publication → capabilities → permissions → policies).  
7. Keep `VALID ≠ AUTHORIZED ≠ EXECUTABLE ≠ PRIVILEGED`.  
8. Ship **documentation + ADR + static tests only** — no executor, iframe, bridge, migrations, or playback changes.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Same-origin iframe for simplicity | Shares cookies/storage; high T3/T4/T13 risk |
| Blob/srcdoc execution | Weak origin/CSP semantics; bridge trust unclear |
| Implement bridge + iframe in this phase | Violates DESIGN → IMPLEMENT order; expands attack surface early |
| Trust published packages as privileged | Breaks validation≠trust invariant |
| Wildcard `targetOrigin="*"` | Enables T12 postMessage abuse |

---

## Consequences

### Positive

- Clear checklist for EXPERIENCE-05+ hosting and bridge work.  
- Aligns Device Runtime fullscreen/orientation with Experience requests.  
- Playback remains untouched.

### Risks

- Dedicated origin requires future DNS/TLS/ops — deferred explicitly.  
- Authors may assume design equals runtime — docs must keep “design only” visible.

### Deliberately deferred

- Origin provisioning  
- iframe host / CSP headers  
- Bridge implementation  
- CONTENT_TYPE / playback integration  
- DB tables / upload APIs  

---

## References

- `docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md`  
- `docs/evidence/runtime-experience-04/RUNTIME-SECURITY-CHECKLIST.md`  
- `npm run test:runtime-experience-04`
