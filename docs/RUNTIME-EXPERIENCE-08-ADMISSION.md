# Vitrine360 — RUNTIME-EXPERIENCE-08  
# Admission Control + Device Policy

**Date:** 2026-09-23  
**Status:** ADMISSION CONTROL VALIDATED (domain gate · no Player wire)  
**Depends on:** EXPERIENCE-01 … 07 · RUNTIME-POLICY-01 … 08B  
**ADR:** [ADR-EXPERIENCE-008](./adr/ADR-EXPERIENCE-008.md)

**Not claimed:** HTML_APP · Player integration · Fullscreen/Orientation CONTROL bridge · Production Ready

---

## 1. Purpose

Provide a **fail-closed** admission decision before any future sandboxed Experience load or bridge activation:

```text
Registry → Tenant → Version → Integrity → Publication → Blocked?
  → Assignment → Device → Capabilities → Permissions
  → Network → Storage → Device Runtime Policy
  → ADMIT | DENY
```

Serving bytes (EX-05) ≠ admitted for device execution.  
Validated package ≠ authorized on a device.  
Browser capability ≠ Experience privilege.

---

## 2. Trust Model

| Claim | Meaning |
|-------|---------|
| VALID | Package passed validator |
| PUBLISHED | Registry allows assignment/serve |
| ASSIGNED | Device has non-revoked assignment |
| ADMITTED | `admitExperienceForDevice` returned ADMIT |
| EXECUTABLE | Future runtime host actually loads iframe (EX-09+) |

EX-08 implements **ADMITTED** only.

---

## 3. Inputs (no secrets)

| Input | Role |
|-------|------|
| Registry record | Identity, sha256, validation/publication, manifest snapshot |
| Assignment | tenant/device/experience/version + grantedPermissions + revoked |
| Device context | status, DomainRuntimePolicy, DetectedRuntimeCapabilities, runtimeVersion |
| Kill switch | Global ops deny |

**Never** as input: Device Bearer, JWT, AUTH_SECRET, DB client, R2 credentials, cookies.

---

## 4. Device Policy Intersection

```text
EffectiveCapability =
  DetectedRuntimeCapabilities (mapped)
  ∩ Manifest.capabilities
  ∩ Admin grantedPermissions
```

Mapping (probe → Experience id):

| Detected | Experience |
|----------|------------|
| touch | TOUCH |
| keyboard | KEYBOARD |
| pointer | MOUSE |
| fullscreen | FULLSCREEN |
| orientation | ORIENTATION |
| network | NETWORK |
| indexedDB | OFFLINE_STORAGE |

CAMERA / MICROPHONE are **never** inferred from generic probe in v1.

DomainRuntimePolicy (POLICY-01/05) contributes **orientation** compatibility and remains SSoT for device presentation — admission does **not** mutate Player controllers.

---

## 5. Network / Storage

- `networkPolicy.mode !== NONE` requires `permissions.network === true`
- `FULL_NETWORK` requires audited `assignment.allowFullNetwork === true`
- `ALLOWLIST` with empty list → DENY
- `PERSISTENT` storage requires `offlineStorage` permission

---

## 6. Kill Switch / Revocation

| Layer | Code |
|-------|------|
| Global killSwitch | `ADMISSION_KILL_SWITCH` |
| publicationState BLOCKED | `ADMISSION_BLOCKED` |
| publicationState DEPRECATED | `ADMISSION_DEPRECATED` |
| assignment.revoked | `ADMISSION_ASSIGNMENT_REVOKED` |
| device DISABLED/REVOKED/… | `ADMISSION_DEVICE_DISABLED` |

---

## 7. Bridge Coupling (read-only)

On ADMIT:

- `bridgeRuntimeRead: true` → host may grant bridge `RUNTIME_READ`
- Effective capabilities exposed as optional bridge capability set
- **No** CONTROL / MUTATION methods enabled by admission alone
- Fullscreen/Orientation CONTROL remain **DEFERRED** (EX-07)

---

## 8. Cross-tenant

Deny when:

- record.tenant ≠ request.tenant  
- device.tenant ≠ request.tenant  
- assignment.tenant ≠ request.tenant  

Codes: `ADMISSION_TENANT_MISMATCH` / `ADMISSION_DEVICE_TENANT_MISMATCH`

---

## 9. Relation to Serve Admission (EX-05)

| Gate | Purpose |
|------|---------|
| `admitPackageServe` | HTTP serve package bytes on Experience origin |
| `admitExperienceForDevice` | Device may load / bridge that package |

A package may be serveable (PUBLISHED) yet **denied** on a device (no assignment, capability miss, kill switch).

---

## 10. Non-goals

- No Player playlist / CONTENT_TYPES change  
- No iframe auto-load from admission  
- No DB tables / migrations  
- No admin UI assignment CRUD  
- No token forwarding  
- No network/storage proxy APIs  

---

## 11. Security Invariants

| ID | Invariant |
|----|-----------|
| ADM-SEC-001 | Deny by default |
| ADM-SEC-002 | Tenant equality required |
| ADM-SEC-003 | VALID + PUBLISHED required |
| ADM-SEC-004 | Integrity SHA-256 checked |
| ADM-SEC-005 | Assignment required + non-revoked |
| ADM-SEC-006 | Capability ∩ permission |
| ADM-SEC-007 | Network/storage policy clamped |
| ADM-SEC-008 | No secrets in context |
| ADM-SEC-009 | No Player mutation |
| ADM-SEC-010 | Kill switch / block honored |

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-008.md`  
- Checklist: `docs/evidence/runtime-experience-08/ADMISSION-CHECKLIST.md`  
- Module: `src/domain/experience-admission.ts`  
- Tests: `npm run test:runtime-experience-08`
