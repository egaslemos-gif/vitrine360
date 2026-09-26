# ADR-EXPERIENCE-010 — Experience Runtime Core + Lifecycle

**Status:** Accepted — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-10  
**Depends on:** ADR-EXPERIENCE-001 … 008  
**Related:** `docs/RUNTIME-EXPERIENCE-10-RUNTIME-CORE.md`

---

## Context

Admission (EX-08), sandbox (EX-06), and bridge (EX-07) exist, but no host controller turns an ADMITTED grant into a managed running instance with STOP/KILL and load failure isolation. EXPERIENCE-09 (playback CONTENT_TYPE integration) is not present; this phase must not invent playlist wiring.

---

## Decision

1. Introduce pure-domain `ExperienceRuntimeController` with explicit lifecycle phases.  
2. Introduce `ExperienceRuntimeShell` that mounts `ExperienceSandboxFrame` only while the controller says the frame should run.  
3. Require a prior **admission grant**; never start from VALID/PUBLISHED alone.  
4. Keep privilege matrix **DENY / DEFERRED** — execution does not grant network/storage/device/playback control.  
5. Attach Controlled Bridge v1 **RUNTIME_READ** only.  
6. Enforce load timeout fail-closed.  
7. Kill/stop tear down without Experience cooperation.  
8. Do **not** modify Player, playlist, schedule, Device, or `CONTENT_TYPES`.

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Start without admission | Violates EX-04/08 |
| Auto-privilege from browser caps | Privilege escalation |
| Wire into playlist in this phase | Belongs to EX-09 (missing) |
| Fullscreen CONTROL via runtime | Deferred / unsafe |
| Trust Experience to stop itself | Kill must be host-authoritative |

---

## Consequences

### Positive

- Auditable lifecycle + safe fallback UI  
- Clear coupling point for a future EX-09 Player gate  

### Risks

- Without EX-09, Experiences are not scheduled via content pipeline  
- Dedicated origin still required for strong isolation in production  

---

## References

- `src/domain/experience-runtime.ts`  
- `src/features/experience-runtime/`  
- `npm run test:runtime-experience-10`
