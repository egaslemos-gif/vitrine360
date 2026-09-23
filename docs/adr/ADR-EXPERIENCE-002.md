# ADR-EXPERIENCE-002 — Experience Package & Manifest Contract

**Status:** Accepted (contract / specification only) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-02  
**Depends on:** ADR-EXPERIENCE-001  
**Related:** `docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md`

---

## Context

RUNTIME-EXPERIENCE-01 established the security boundary: Experiences are untrusted packages that must not receive host secrets or DOM access, and must eventually run in an isolated origin / sandboxed iframe with a controlled bridge.

Before any upload, validation service, or executor exists, the product needs a **frozen contract** for:

- what files constitute a package;  
- what `manifest.json` must contain;  
- how versioning, integrity, capabilities, permissions, network, and storage are expressed;  
- how validation and error states are named.

Without that contract, implementers will invent incompatible schemas and leak security decisions into ad-hoc code.

---

## Problem

How do we define an Experience Package and Manifest so that future Runtime work can validate and authorize packages safely, without implementing execution now?

---

## Decision

1. Adopt **manifest `schemaVersion: "1.0"`** as the first formal contract, documented in RUNTIME-EXPERIENCE-02.  
2. Treat packages as `experience.zip` with required `manifest.json` + entrypoint file; deny path traversal, symlinks, external entrypoints, and nested archives.  
3. Separate **Experience version** (semver), **schema version**, and **runtime compatibility**.  
4. Separate **capability** (request) vs **permission** (authorization) vs **device capability** (probe). Effective = intersection.  
5. Default **network**, **storage**, and **permissions** to **deny** (`NONE` / all `false`).  
6. Allow `runtimeLimits` fields to be `"UNSPECIFIED"` until Runtime measures budgets — do not invent fake numbers.  
7. Define validation states (`UNVALIDATED`…`BLOCKED`) and error codes without implementing handlers.  
8. **Do not** implement HTML_APP, executor, upload, bridge, or migrations in this phase.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Skip formal schema; invent at first PR | Incompatible packages; security bolted on late |
| Reuse Device Manifest / MediaAsset as Experience | Wrong trust model; mixes trusted media with untrusted code |
| Require all runtime limits now with guessed MiB/CPU | Arbitrary; false sense of enforcement |
| Allow remote CDN deps by default | Supply-chain / tracking / offline failure |
| Collapse capability and permission into one flag | Breaks device probe vs admin policy model |
| Implement Zod + upload in same phase | Violates DESIGN → CONTRACT → IMPLEMENT order |

---

## Consequences

### Positive

- Clear checklist for EXPERIENCE-03+ validators.  
- Threat model T1–T14 mapped to concrete contract rules.  
- Playback / device runtime remain untouched.

### Risks

- Spec drift if later PRs ignore `schemaVersion`.  
- Authors may assume `VALID` means runnable — docs must keep repeating VALID ≠ AUTHORIZE.

### Deliberately deferred

- Numeric limit enforcement  
- Digital signatures  
- Zod in `src/`  
- Sandbox / bridge / Content enum / DB  

---

## References

- `docs/RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md`  
- `docs/evidence/runtime-experience-02/PACKAGE-CONTRACT-CHECKLIST.md`  
- `npm run test:runtime-experience-02`
