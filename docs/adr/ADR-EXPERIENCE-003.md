# ADR-EXPERIENCE-003 — Experience Package Validator & Registry Architecture

**Status:** Accepted (validator + conceptual registry) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-03  
**Depends on:** ADR-EXPERIENCE-001, ADR-EXPERIENCE-002  
**Related:** `docs/RUNTIME-EXPERIENCE-03-VALIDATOR-REGISTRY.md`

---

## Context

EXPERIENCE-01 defined the security boundary. EXPERIENCE-02 froze the package/manifest contract. Before any upload or Player integration, the platform needs a **deterministic validator** and a **registry lifecycle model** so that “stored package” is never confused with “trusted” or “executable”.

---

## Problem

How do we validate Experience Packages and model their registry lifecycle without executing untrusted content or coupling to playback?

---

## Decision

1. Implement a **pure domain validator** (`experience-validator.ts`) that reads bytes/ZIP/JSON only.  
2. Encode the EXPERIENCE-02 pipeline stages and map failures to validation states (`VALID` / `INVALID` / `INCOMPATIBLE` / `BLOCKED`).  
3. Compute **effective capabilities** as Device ∩ Requested ∩ Permission when assignment context is supplied.  
4. Model **Registry publication states** and transitions in domain code **without** DB migrations.  
5. Enforce **tenant identity** at the conceptual registry boundary (`assertSameTenant`).  
6. **Do not** implement executor, iframe, bridge, upload API, or CONTENT_TYPE changes.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Validate only at Player load | Too late; malicious packages would already be assigned |
| Persist tables in this phase | Couples schema before upload/UX design settles |
| Execute smoke HTML in validator | Violates isolation; turns validator into executor |
| Collapse VALID and PUBLISHED | Breaks VALID ≠ AUTHORIZED principle |
| Allow remote CDN deps freely | Supply-chain / offline / tracking risk |

---

## Consequences

### Positive

- Deterministic reject rules for EXPERIENCE-04+ upload.  
- Clear registry state machine for admin workflows.  
- Playback / Device Runtime untouched.

### Risks

- ZIP reader supports only STORE/DEFLATE — unusual methods reject (acceptable).  
- MIME sniffing not implemented — declared MIME checked for shape only; sniff consistency deferred.

### Deliberately deferred

- Upload HTTP + blob storage  
- Drizzle tables / migrations  
- Digital signatures  
- Full MIME sniffing  
- Runtime / sandbox / bridge  

---

## References

- `docs/RUNTIME-EXPERIENCE-03-VALIDATOR-REGISTRY.md`  
- `src/domain/experience-manifest.ts`  
- `src/domain/experience-validator.ts`  
- `src/domain/experience-registry.ts`  
- `npm run test:runtime-experience-03`
