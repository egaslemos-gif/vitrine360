# ADR-EXPERIENCE-008 — Experience Admission Control + Device Policy

**Status:** Accepted — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-08  
**Depends on:** ADR-EXPERIENCE-001 … 007 · RUNTIME-POLICY-01 … 08B  
**Related:** `docs/RUNTIME-EXPERIENCE-08-ADMISSION.md`

---

## Context

EXPERIENCE-05 serves packages; EXPERIENCE-06/07 provide sandbox + bridge.  
EXPERIENCE-04 requires fail-closed **admission** before execution. Without a device-scoped gate, PUBLISHED packages could be treated as automatically runnable on any device.

---

## Decision

1. Introduce pure-domain `admitExperienceForDevice()` as the single admission decision function.  
2. Require **registry + assignment + device context** — publication alone is insufficient.  
3. Compute effective capabilities as **Detected ∩ Requested ∩ AdminGranted**.  
4. Clamp network/storage policies; deny FULL_NETWORK without audited flag.  
5. Honor kill switch, BLOCKED, DEPRECATED, revoked assignment, disabled device.  
6. On ADMIT, authorize bridge **RUNTIME_READ** only — no CONTROL elevation.  
7. Do **not** wire Player / CONTENT_TYPES / iframe auto-start in this phase.

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Admit on VALID alone | Validation ≠ authorization |
| Admit on PUBLISHED alone | Cross-device / no assignment |
| Browser capability ⇒ grant | Privilege escalation |
| Implicit ALLOW_ALL permissions | Fail-open |
| Admission mutates Player | Wrong boundary (EX-09) |
| Secrets in admission context | Token leakage risk |

---

## Consequences

### Positive

- Auditable deny codes per pipeline stage  
- Clear coupling point for future host loader  

### Risks

- Assignment model still conceptual (no persistence) — call sites must supply records  

### Deferred

- Persistence of assignments  
- Player content-type integration (EX-09)  
- Fullscreen/Orientation CONTROL via bridge  

---

## References

- `src/domain/experience-admission.ts`  
- `npm run test:runtime-experience-08`
