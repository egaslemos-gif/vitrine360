# Vitrine360 — RUNTIME-EXPERIENCE-03  
# Experience Package Validator & Registry Architecture

**Date:** 2026-09-23  
**Status:** VALIDATOR ARCHITECTURE VALIDATED (limited pure implementation)  
**Depends on:** [RUNTIME-EXPERIENCE-02](./RUNTIME-EXPERIENCE-02-PACKAGE-CONTRACT.md), [ADR-EXPERIENCE-002](./adr/ADR-EXPERIENCE-002.md)  
**ADR:** [ADR-EXPERIENCE-003](./adr/ADR-EXPERIENCE-003.md)

**Not claimed:** Experience Runtime · HTML_APP · upload API · executor · Player integration · PRODUCTION / PHYSICAL VALIDATED

---

## 1. Purpose

Implementar a camada de **validação determinística** de Experience Packages e o **modelo conceptual de Registry**, sem executar qualquer conteúdo do package.

Princípio:

```text
PACKAGE ≠ TRUST
VALID ≠ AUTHORIZED
AUTHORIZED ≠ EXECUTABLE
```

Prioridade:

```text
SECURITY → DETERMINISM → TENANT ISOLATION → INTEGRITY → COMPATIBILITY → AUDITABILITY
```

---

## 2. Scope

### In scope (implemented / specified)

1. Package validation  
2. Manifest validation  
3. Package integrity validation  
4. Asset validation  
5. Compatibility evaluation  
6. Capability requirement evaluation  
7. Permission evaluation  
8. Network policy validation  
9. Storage policy validation  
10. Package Registry conceptual model  
11. Experience version lifecycle  
12. Publication states  
13. Blocking / deprecation  
14. Tenant isolation  
15. Auditability (event model)

### Out of scope (forbidden)

| Item | Status |
|------|--------|
| HTML_APP / EXPERIENCE in `CONTENT_TYPES` | Forbidden |
| Experience Runtime / iframe / sandbox / bridge | Forbidden |
| Execution of HTML/CSS/JS from package | Forbidden |
| Playback / scheduler / Device manifest changes | Forbidden |
| DB tables / migrations / upload HTTP API | Forbidden |

---

## 3. Implementation map

| Module | Role |
|--------|------|
| `src/domain/experience-manifest.ts` | Contract types (schema 1.0) |
| `src/domain/experience-validator.ts` | Validation pipeline + ZIP reader (bytes only) |
| `src/domain/experience-registry.ts` | Publication states + tenant guards (no persistence) |

Validator **may** read: bytes, ZIP entries, JSON.  
Validator **must not** execute: HTML, JS, CSS, dependency code.

---

## 4. Package validation pipeline

```text
RAW PACKAGE
    │
    ▼
STRUCTURAL VALIDATION
    │
    ▼
MANIFEST EXTRACTION
    │
    ▼
MANIFEST SCHEMA VALIDATION
    │
    ▼
PATH VALIDATION
    │
    ▼
ENTRYPOINT VALIDATION
    │
    ▼
ASSET INVENTORY VALIDATION
    │
    ▼
ASSET INTEGRITY VALIDATION
    │
    ▼
DEPENDENCY VALIDATION
    │
    ▼
POLICY VALIDATION
    │
    ▼
COMPATIBILITY EVALUATION
    │
    ▼
VALIDATION RESULT
```

API:

```ts
validateExperiencePackage(inventory, compatibilityContext?) → PackageValidationResult
readZipInventory(zipBytes) → PackageInventory
parseManifestJson(raw) → manifest | issues
```

---

## 5. Structural validation

Reject:

- empty packages  
- missing root `manifest.json`  
- symlinks  
- path traversal / absolute / protocol paths  
- unsafe path segments  
- hidden / metadata (`__MACOSX`, `.git`, …)  
- forbidden binaries (`.exe`, `.dll`, `.apk`, …)  
- nested archives (`.zip`, `.jar`, …)  
- duplicate entry paths  
- max path depth **8**

---

## 6. Manifest schema validation

- `schemaVersion` must be `"1.0"` → else `EXPERIENCE_UNSUPPORTED_SCHEMA` / `INCOMPATIBLE`  
- Required fields per EXPERIENCE-02  
- Semver `MAJOR.MINOR.PATCH` for Experience `version`  
- Critical unknown keys (`execute`, `hostTokens`, …) → `INCOMPATIBLE`  
- Non-critical unknowns ignored

---

## 7. Entrypoint & assets

- Entrypoint path normalized; must exist inside package  
- Assets: unique paths, MIME with `/`, size ≥ 0, sha256 hex  
- Missing asset → `EXPERIENCE_ASSET_MISSING`  
- Size/hash mismatch → `EXPERIENCE_ASSET_INTEGRITY_FAILED`  
- Undeclared `.js/.mjs/.wasm` (not entrypoint / not bundled dep) → reject

---

## 8. Dependencies

| Kind | Rule |
|------|------|
| `bundled` | Path must exist; sha256 must match |
| `remote` | HTTPS URL only; requires `permissions.network` and non-`NONE` network policy |

Prefer bundled. Remote is exceptional and policy-gated.

---

## 9. Policy validation

| Policy | Default / rule |
|--------|----------------|
| Network | `NONE` preferred; `FULL_NETWORK` requires `allowFullNetwork` audited flag |
| Storage | `PERSISTENT` requires `permissions.offlineStorage` |
| Capabilities | `NETWORK` + `networkPolicy.NONE` → inconsistent → deny |

---

## 10. Compatibility & effective capabilities

```text
effective = DeviceCapabilities ∩ Experience.capabilities ∩ AdminPermissions
```

- Missing device capability → `EXPERIENCE_CAPABILITY_UNSUPPORTED` → often `INCOMPATIBLE`  
- Denied permission (when assignment context provided) → `EXPERIENCE_PERMISSION_DENIED` → `BLOCKED`  
- Runtime below `minimumRuntimeVersion` → `EXPERIENCE_RUNTIME_INCOMPATIBLE`

Package-only validation (no assignment context) skips permission denial.

---

## 11. Validation result states

| State | Meaning |
|-------|---------|
| `VALID` | Structure + contract OK |
| `INVALID` | Structural / schema / integrity failure |
| `INCOMPATIBLE` | Schema/runtime/capability unsupported |
| `BLOCKED` | Valid-ish but permission/block denies use |

`VALID` does **not** mean published, assigned, or executable.

---

## 12. Registry conceptual model

### Entities (future persistence — not created now)

- **Experience** `(tenantId, experienceId)`  
- **PackageVersion** `(tenantId, experienceId, version, packageSha256, validationState, publicationState)`  
- **AuditEvent** (action, actor, timestamp, detail)

### Publication states

```text
DRAFT → VALIDATED → PUBLISHED ⇄ DEPRECATED → ARCHIVED
                 ↘ BLOCKED ↗
```

| Transition rule | |
|-----------------|-|
| Publish | requires `validationState === VALID` |
| Block | allowed from most non-archived states |
| Cross-tenant access | **always deny** |

```text
VALID ≠ PUBLISHED ≠ ASSIGNABLE ≠ EXECUTABLE
```

Assignable publication today: `PUBLISHED` only.  
Executable still requires a future Runtime phase.

### Auditability

Conceptual actions: `RECEIVED`, `VALIDATED`, `VALIDATION_FAILED`, `PUBLISHED`, `DEPRECATED`, `BLOCKED`, `ARCHIVED`, `UNBLOCKED`.

---

## 13. Tenant isolation

- Every registry identity includes `tenantId`  
- `assertSameTenant` before mutations  
- Tenant A package must never validate-as-executable for Tenant B Device (enforced at assign/load later; modelled here)

---

## 14. Integrity

- Per-asset SHA-256  
- Optional package SHA-256 (zip bytes or deterministic fingerprint)  
- integrity ≠ authenticity ≠ authorization

---

## 15. ZIP handling

`readZipInventory`:

- Parses central directory  
- Extracts STORE / DEFLATE only  
- Rejects encrypted entries  
- Surfaces symlink flag for structural reject  
- **Never** evaluates JS/HTML

---

## 16. Error codes

Uses EXPERIENCE-02 codes plus:

- `EXPERIENCE_PATH_INVALID`  
- `EXPERIENCE_FORBIDDEN_ENTRY`  
- `EXPERIENCE_DEPENDENCY_INVALID`

---

## 17. Threat mapping (delta)

| Threat | How EXPERIENCE-03 reduces risk |
|--------|--------------------------------|
| T6 Arbitrary network | Policy validation + remote dep gates |
| T9 Exhaustion | Optional numeric `runtimeLimits` enforcement when not UNSPECIFIED |
| T10 Malicious package | Structural + integrity reject |
| T11 Compromised dependency | Bundled hash check; remote discouraged |
| T14 Cross-tenant | Registry tenant identity + assertSameTenant |

Execution threats (T2, T3, T4, T12) remain deferred to sandbox/bridge phases.

---

## 18. Future boundaries

1. Upload API + blob storage (still no execute)  
2. Persist registry tables  
3. Admin publish UX  
4. Sandbox host + CSP  
5. Bridge + Player integration (separate ADRs)

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-003.md`  
- Checklist: `docs/evidence/runtime-experience-03/VALIDATOR-REGISTRY-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-03`
