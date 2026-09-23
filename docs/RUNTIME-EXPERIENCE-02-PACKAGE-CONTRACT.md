# Vitrine360 — RUNTIME-EXPERIENCE-02  
# Experience Package & Manifest Contract

**Date:** 2026-09-23  
**Status:** CONTRACT VALIDATED (specification only)  
**Depends on:** [RUNTIME-EXPERIENCE-01](./RUNTIME-EXPERIENCE-01-ARCHITECTURE.md), [ADR-EXPERIENCE-001](./adr/ADR-EXPERIENCE-001.md)  
**ADR:** [ADR-EXPERIENCE-002](./adr/ADR-EXPERIENCE-002.md)

**Not claimed:** Experience Runtime · HTML_APP · upload · executor · PRODUCTION / PHYSICAL VALIDATED

---

## 1. Purpose

Formalizar o **contrato** de uma Experience Package (`experience.zip`) e do `manifest.json`, de modo que fases futuras possam validar, armazenar e (só depois) executar Experiences sem ambiguidade.

Princípio:

```text
UPLOAD ≠ TRUST
STORE ≠ EXECUTE
VALIDATE ≠ AUTHORIZE
AUTHORIZE ≠ CAPABILITY
CAPABILITY ≠ PERMISSION
```

Uma package **VALID** não implica execução autorizada.

---

## 2. Scope

### In scope

- Package structure rules  
- Manifest schema contract (`schemaVersion` **1.0**)  
- Versioning (package / schema / runtime compatibility)  
- Assets, integrity, dependencies  
- Capabilities vs permissions  
- Network / storage / offline policies (deny-by-default)  
- Runtime limits (values may be `UNSPECIFIED`)  
- Lifecycle, validation states, compatibility, multi-tenancy  
- Error model + threat mapping T1–T14  

### Out of scope (non-goals)

| Item | Status |
|------|--------|
| HTML_APP / EXPERIENCE in `CONTENT_TYPES` | Forbidden |
| ExperienceRuntime / Executor / Sandbox / Bridge | Forbidden |
| Upload / parse / execute HTML/CSS/JS | Forbidden |
| DB tables / migrations | Forbidden |
| Playback / schedule / device runtime / storage provider changes | Forbidden |

---

## 3. Non-goals

- Não escolher limites numéricos inventados sem justificação → usar `UNSPECIFIED` quando aplicável.  
- Não implementar validadores Zod em `src/` nesta fase.  
- Não definir CSP bytes finais (já coberto em EXPERIENCE-01; reforçado aqui apenas no contrato).  
- Não criar assinatura digital (apenas preparar o slot conceptual).

---

## 4. Package structure

### Canonical layout

```text
experience.zip
├── manifest.json          REQUIRED
├── index.html             REQUIRED (default entrypoint)
├── styles.css             OPTIONAL
├── app.js                 OPTIONAL
└── assets/                OPTIONAL
    ├── image-01.png
    ├── video-01.mp4
    └── …
```

### Rules

| Rule | Requirement |
|------|-------------|
| `manifest.json` | Required at package root |
| Entrypoint file | Required; must exist inside package; default `index.html` |
| `styles.css` / `app.js` | Optional |
| `assets/` | Optional directory for media/static files |
| Path traversal (`..`, absolute paths) | **Reject** |
| Symlinks | **Reject** |
| Protocols in paths (`javascript:`, `http:`, `https:`, `data:`, `blob:`) as entrypoint/asset path | **Reject** |
| Hidden / metadata abuse (e.g. `__MACOSX/`, `.git/`) | **Reject** when present as package members |
| Unsafe filenames | Reject control chars, NUL, path separators in basename; prefer `[A-Za-z0-9._-]` |
| Max path depth | Conceptual limit: **8** segments under package root (reject deeper) |
| Max package size | Conceptual target documented under runtime limits; if unset → `UNSPECIFIED` until Runtime phase |

### Classification of extra files

| Kind | Policy |
|------|--------|
| Declared in `assets[]` | Allowed if type/integrity OK |
| Undeclared non-entrypoint files | Future validator: **reject** or require declaration (contract: prefer **reject undeclared executable-like** `.js/.mjs/.wasm` outside assets list) |
| Binary executables (`.exe`, `.dll`, `.so`, `.apk`) | **Forbidden** |
| Nested archives | **Forbidden** in v1.0 contract |

**Upload is not implemented in this phase.**

---

## 5. Manifest contract

### Conceptual TypeScript (documentation only — not operational code)

```ts
/** Manifest schemaVersion 1.0 — SPECIFICATION ONLY */
type ExperienceManifestV1 = {
  schemaVersion: "1.0";
  id: string;
  version: string; // semver MAJOR.MINOR.PATCH
  name: string;
  description?: string;
  entrypoint: string; // relative path, typically "index.html"
  assets: ExperienceAsset[];
  dependencies: ExperienceDependency[];
  capabilities: ExperienceCapabilityId[];
  permissions: ExperiencePermissions;
  networkPolicy: ExperienceNetworkPolicy;
  storagePolicy: ExperienceStoragePolicy;
  offlineRequirements: ExperienceOfflineMode;
  runtimeLimits: ExperienceRuntimeLimits;
  compatibility?: ExperienceCompatibility;
  /** Non-critical unknown fields may be ignored; critical unknowns → INCOMPATIBLE */
};
```

### Minimum JSON shape

```json
{
  "schemaVersion": "1.0",
  "id": "exp_demo_product_finder",
  "version": "1.2.0",
  "name": "Product Finder",
  "description": "Optional admin-facing description",
  "entrypoint": "index.html",
  "assets": [],
  "dependencies": [],
  "capabilities": [],
  "permissions": {
    "touch": false,
    "keyboard": false,
    "mouse": false,
    "camera": false,
    "microphone": false,
    "network": false,
    "offlineStorage": false,
    "fullscreen": false,
    "orientation": false
  },
  "networkPolicy": {
    "mode": "NONE"
  },
  "storagePolicy": {
    "mode": "NONE"
  },
  "offlineRequirements": {
    "mode": "OFFLINE_PREFERRED"
  },
  "runtimeLimits": {
    "packageSizeBytes": "UNSPECIFIED",
    "assetCount": "UNSPECIFIED",
    "memoryMb": "UNSPECIFIED",
    "cpuTimeMs": "UNSPECIFIED",
    "networkRequests": "UNSPECIFIED",
    "storageBytes": "UNSPECIFIED",
    "maxSessionSeconds": "UNSPECIFIED"
  }
}
```

### Field definitions

#### `schemaVersion`

- **Required.** Version of **this contract**, not the Experience.  
- Current: `"1.0"`.  
- Unsupported schema → `EXPERIENCE_UNSUPPORTED_SCHEMA` / state `INCOMPATIBLE` or `INVALID` (see §16).

#### `id`

- **Required.** Stable Experience identity (tenant-scoped in future persistence).  
- Must not be the display `name`.  
- Must not change on every publish of the same logical Experience.  
- Recommended pattern: opaque string / slug prefixed (`exp_…`); not a filename.

#### `version`

- **Required.** Experience package semver: `MAJOR.MINOR.PATCH`.  
- **MAJOR:** breaking Experience behaviour / required capabilities / entrypoint semantics.  
- **MINOR:** backward-compatible features.  
- **PATCH:** fixes / asset refreshes without contract break.  
- Distinct from `schemaVersion` and runtime compatibility.

#### `name`

- Admin-facing label. **Not** a technical identity.

#### `description`

- Optional human text.

#### `entrypoint`

- **Required.** Relative path inside package (default `"index.html"`).  
- Must resolve to an existing package member.  
- **Reject:** external URL, `javascript:`, absolute path, `../`, normalized escape outside root.

#### `assets`

- Array (may be empty). Each entry:

| Field | Rule |
|-------|------|
| `path` | Relative; no traversal; unique within list |
| `type` | Declared MIME (e.g. `image/png`); **must not** be trusted from extension alone — future server validates sniff/consistency |
| `size` | Non-negative integer bytes |
| `sha256` | Lowercase hex SHA-256 of file bytes |

#### `dependencies`

- See §8.

#### `capabilities` / `permissions` / `networkPolicy` / `storagePolicy` / `offlineRequirements` / `runtimeLimits`

- See §§9–14.

#### Unknown fields policy

| Kind | Behaviour |
|------|-----------|
| Unknown **non-critical** | May be ignored by validators of schema 1.0 |
| Unknown marked **critical** (future `critical: true` envelope) or reserved breaking keys | → `INCOMPATIBLE` |
| Malformed known fields | → `INVALID` |

---

## 6. Versioning

Three distinct version axes:

| Axis | Example | Meaning |
|------|---------|---------|
| Experience / package version | `1.4.2` | Author-published Experience revision |
| Manifest schema version | `1.0` | This contract |
| Runtime compatibility | `1.x` (future field) | Host Experience Runtime generation |

**Do not mix them.**

---

## 7. Assets

- All executable/static members intended for load should be listed when not the entrypoint itself (entrypoint may be omitted from `assets` if identically named and hashed via package hash — contract recommendation: **also list entrypoint in `assets`** for uniform integrity).  
- Duplicate `path` → reject.  
- Missing file for listed path → reject.  
- Hash mismatch → reject.  
- MIME inconsistency (declared vs sniffed) → reject.

---

## 8. Dependencies

| Kind | Policy (schema 1.0) |
|------|---------------------|
| **Bundled** (files inside package) | **Preferred** |
| **External remote CDN** (URL to JS/CSS) | **Discouraged**; if present must be explicit and subject to network policy + integrity (future) |
| **Arbitrary remote executable** | **Forbidden** as silent default |

Conceptual dependency object:

```json
{
  "id": "chart-lib",
  "kind": "bundled",
  "path": "assets/vendor/chart.js",
  "sha256": "…"
}
```

or (exceptional, future-gated):

```json
{
  "id": "chart-lib",
  "kind": "remote",
  "url": "https://cdn.example/chart.js",
  "sha256": "…"
}
```

Risks of remote deps: supply-chain, CDN compromise, version drift, tracking, availability, offline failure (T6, T11).

---

## 9. Capabilities

**Requested** by Experience (what it needs):

| ID | Meaning |
|----|---------|
| `TOUCH` | Touch input |
| `KEYBOARD` | Keyboard-like input |
| `MOUSE` | Pointer/mouse |
| `CAMERA` | Camera |
| `MICROPHONE` | Microphone |
| `NETWORK` | Outbound network (further limited by network policy) |
| `OFFLINE_STORAGE` | Persistent Experience storage |
| `FULLSCREEN` | May *request* fullscreen via host |
| `ORIENTATION` | May *request* orientation via host |

Empty `capabilities` = no special requests beyond sandboxed display of static UI.

**Declared ≠ available ≠ allowed.**

---

## 10. Permissions

Admin/product authorization flags (deny-by-default). Conceptual object — all default `false`:

```json
{
  "touch": false,
  "keyboard": false,
  "mouse": false,
  "camera": false,
  "microphone": false,
  "network": false,
  "offlineStorage": false,
  "fullscreen": false,
  "orientation": false
}
```

| Concept | Meaning |
|---------|---------|
| Device capability | Probe / hardware can do X |
| Experience capability | Package requests X |
| Permission | Product/admin allows X for this Experience |
| **Effective** | Device ∩ Requested ∩ Permission |

Unsupported ≠ unauthorized (see §18).

---

## 11. Network policy

```json
{ "mode": "NONE" }
```

| Mode | Semantics |
|------|-----------|
| `NONE` | **Default.** No external communication |
| `SAME_ORIGIN` | Only the dedicated Experience origin |
| `ALLOWLIST` | Only listed HTTPS hosts (`allowlist: string[]`) |
| `FULL_NETWORK` | Explicit audited exception — **never default** |

Additional rules (conceptual):

- Prefer **HTTPS only** for allowlist entries.  
- Redirects to non-allowlisted hosts → deny.  
- WebSocket / WebRTC → require explicit future flags; default deny.  
- External fonts / CDN / analytics / third-party scripts → deny unless allowlisted under `ALLOWLIST` / exceptional policy.  
- Tracking endpoints → deny by default.

---

## 12. Storage policy

```json
{ "mode": "NONE" }
```

| Mode | Semantics |
|------|-----------|
| `NONE` | **Default.** No durable Experience storage |
| `EPHEMERAL` | Session-only, wiped on STOP |
| `PERSISTENT` | Requires permission `offlineStorage: true` + quota |

**Forbidden direct use:** Vitrine360 IndexedDB, LocalStorage, Cache Storage, application cookies.

Future: Experience-isolated storage only.

---

## 13. Offline requirements

```json
{ "mode": "OFFLINE_PREFERRED" }
```

| Mode | Semantics |
|------|-----------|
| `OFFLINE_REQUIRED` | Must run after prepare without network |
| `OFFLINE_PREFERRED` | Offline when possible; optional online features |
| `ONLINE_REQUIRED` | Must not activate if network requirements unmet |

No Experience-specific Service Worker in this phase.

---

## 14. Runtime limits

```json
{
  "packageSizeBytes": "UNSPECIFIED",
  "assetCount": "UNSPECIFIED",
  "memoryMb": "UNSPECIFIED",
  "cpuTimeMs": "UNSPECIFIED",
  "networkRequests": "UNSPECIFIED",
  "storageBytes": "UNSPECIFIED",
  "maxSessionSeconds": "UNSPECIFIED"
}
```

Each field is either a non-negative number **or** the string `"UNSPECIFIED"`.

**Rationale:** Numeric enforcement belongs to the Runtime phase with measured Player budgets. This contract forbids inventing fake hard limits. When a field is numeric later, validators must reject packages exceeding it.

Conceptual starting targets (non-binding until Runtime adopts them) were discussed in EXPERIENCE-01 (e.g. ~5 MiB package) — **not binding here**.

---

## 15. Lifecycle

States:

`LOAD` → `INIT` → `READY` → `ACTIVE` ⇄ `PAUSED` → `STOPPING` → `STOPPED`  
Any of `INIT`/`READY`/`ACTIVE`/`PAUSED` → `ERROR` (terminal or recoverable per future runtime)

### Valid transitions

| From | To |
|------|-----|
| LOAD | INIT, ERROR |
| INIT | READY, ERROR |
| READY | ACTIVE, ERROR, STOPPING |
| ACTIVE | PAUSED, STOPPING, ERROR |
| PAUSED | ACTIVE, STOPPING, ERROR |
| STOPPING | STOPPED, ERROR |
| STOPPED | (terminal for instance) |
| ERROR | STOPPING or terminal (future policy) |

State machine is **not implemented** in this phase.

---

## 16. Validation states

| State | Meaning |
|-------|---------|
| `UNVALIDATED` | Received / stored; checks not run |
| `VALIDATING` | Checks in progress |
| `VALID` | Structure + contract OK |
| `INVALID` | Structural/contract failure |
| `INCOMPATIBLE` | Manifest OK-ish but schema/runtime/capabilities unsupported |
| `BLOCKED` | Valid but not authorized to execute |

`VALID` ≠ authorized to run.

---

## 17. Integrity

| Mechanism | Role |
|-----------|------|
| Package SHA-256 | Integrity of zip bytes |
| Per-asset SHA-256 | Integrity of members |
| Manifest hash (optional future) | Detect manifest tampering |
| Digital signature (future) | Authenticity of publisher |

```text
integrity ≠ authenticity ≠ authorization
```

SHA-256 vs expected hash proves bytes match expectation — **not** that the author is trusted.

---

## 18. Compatibility

Optional `compatibility` object:

```json
{
  "minimumRuntimeVersion": "1.0.0",
  "maximumRuntimeVersion": "1.x",
  "requiredCapabilities": ["TOUCH"],
  "requiredPermissions": ["touch"],
  "supportedOrientation": ["LANDSCAPE", "PORTRAIT", "AUTO"],
  "supportedInput": ["TOUCH", "KEYBOARD", "MOUSE"],
  "supportedOfflineMode": ["OFFLINE_PREFERRED", "OFFLINE_REQUIRED"]
}
```

| Case | Classification |
|------|----------------|
| Device lacks capability | **unsupported** → often `INCOMPATIBLE` |
| Device has capability; admin denies permission | **unauthorized** → `BLOCKED` / `EXPERIENCE_PERMISSION_DENIED` |

Do not add unused fields for completeness; omit when N/A.

---

## 19. Multi-tenancy

- Experience `id` alone is **not** authorization.  
- Future persistence: every Experience belongs to `tenantId` / workspace.  
- Tenant A package must never resolve as executable for Tenant B Device.  
- **tenant scope MUST be enforced at every future lifecycle stage** (upload, validate, assign, load, bridge).  
- No table in this phase.

---

## 20. Error model

| Code | Typical cause |
|------|----------------|
| `EXPERIENCE_INVALID_MANIFEST` | Malformed / missing required fields |
| `EXPERIENCE_UNSUPPORTED_SCHEMA` | Unknown `schemaVersion` |
| `EXPERIENCE_ENTRYPOINT_INVALID` | Bad/missing entrypoint |
| `EXPERIENCE_ASSET_MISSING` | Listed path absent |
| `EXPERIENCE_ASSET_INTEGRITY_FAILED` | Hash mismatch |
| `EXPERIENCE_PACKAGE_TOO_LARGE` | Over limit (when limits not UNSPECIFIED) |
| `EXPERIENCE_CAPABILITY_UNSUPPORTED` | Device/runtime cannot provide |
| `EXPERIENCE_PERMISSION_DENIED` | Admin permission false |
| `EXPERIENCE_NETWORK_DENIED` | Network policy blocks |
| `EXPERIENCE_STORAGE_DENIED` | Storage policy / permission blocks |
| `EXPERIENCE_RUNTIME_INCOMPATIBLE` | Runtime version / contract mismatch |
| `EXPERIENCE_BLOCKED` | Explicit block |

Handlers are **not** implemented here.

---

## 21. Security validation (future mandatory checks)

| Check | Result |
|-------|--------|
| Path traversal / absolute path | reject |
| External / `javascript:` entrypoint | reject |
| Malformed manifest | reject |
| Unsupported schemaVersion | incompatible/reject |
| Missing entrypoint file | reject |
| Asset hash mismatch | reject |
| Duplicate asset paths | reject |
| Invalid MIME declaration vs content | reject |
| Package size exceeded (when specified) | reject |
| Forbidden file types / nested zip / symlink | reject |
| Malformed permissions / network / storage policy | reject |
| Unknown critical fields | incompatible |
| Unknown non-critical fields | ignore |

---

## 22. Threat mapping (T1–T14)

| Threat | Contract rule that reduces risk | Still out of this phase | Future phase |
|--------|----------------------------------|-------------------------|--------------|
| T1 XSS admin | Experiences never load in Admin; package is data | Admin CSP hardening | Admin security continuous |
| T2 DOM access | No executor; entrypoint isolation rules | Sandbox iframe | EXPERIENCE-03+ |
| T3 Token theft | Identity: no tokens in package/manifest | Bridge deny secrets | Bridge phase |
| T4 Cookie theft | Separate origin (EXPERIENCE-01); no same-origin scripts | Origin hosting | EXPERIENCE-03 |
| T5 Tenant exfiltration | Multi-tenancy requirement; network NONE default | Enforcement code | Assign/load phase |
| T6 Arbitrary network | `networkPolicy.mode` default `NONE` | Enforcement | Runtime + CSP |
| T7 Malicious redirects | No external entrypoint; future no top-nav | Sandbox attrs | EXPERIENCE-03 |
| T8 Popup abuse | Not granted in contract | Sandbox attrs | EXPERIENCE-03 |
| T9 Resource exhaustion | `runtimeLimits` fields (may be UNSPECIFIED) | Numeric enforcement | Runtime |
| T10 Malicious package | Integrity SHA-256; VALID≠AUTHORIZE; BLOCKED | Upload antivirus etc. | Validation service |
| T11 Compromised dependency | Prefer bundled; discourage remote | CDN allowlist UX | Deps policy enforcement |
| T12 postMessage abuse | Bridge not in this phase; principles in EXPERIENCE-01 | Bridge allowlist | Bridge phase |
| T13 Storage leakage | `storagePolicy` default `NONE`; no host stores | Isolated storage impl | Runtime |
| T14 Cross-tenant | Tenant scope MUST | DB + checks | Persistence + assign |

---

## 23. Future implementation boundaries

Ordered (suggested):

1. Zod schema + offline validator (still no execute)  
2. Package upload + integrity service  
3. Sandbox host + CSP + origin  
4. Bridge allowlist  
5. Content enum / playback integration (separate ADR)  

Until then: **specification only**.

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-002.md`  
- Checklist: `docs/evidence/runtime-experience-02/PACKAGE-CONTRACT-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-02`
