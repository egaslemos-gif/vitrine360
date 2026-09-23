# Vitrine360 — RUNTIME-EXPERIENCE-01  
# Interactive Experience Architecture & Security Audit

**Date:** 2026-09-23  
**Status:** ARCHITECTURE VALIDATED (design only)  
**ADR:** [ADR-EXPERIENCE-001](./adr/ADR-EXPERIENCE-001.md)  

**Not claimed:** Experience Runtime implemented · HTML_APP shipped · PHYSICAL DEVICE VALIDATED · PRODUCTION VALIDATED

---

## 1. Scope

### In scope (this phase)

- Trust model and security boundary  
- Conceptual Experience Package / Manifest / Lifecycle  
- Capability vs Permission vs Network / Storage / CSP / Bridge principles  
- Threat model (T1–T14)  
- ADR + validation that **no executor** shipped  

### Explicitly out of scope

| Forbidden in this phase | Status |
|-------------------------|--------|
| `HTML_APP` in Content enum | **Not added** |
| Experience Runtime / iframe executor | **Not created** |
| postMessage bridge (functional) | **Not created** |
| Package upload | **Not created** |
| DB migration / Experience table | **Not created** |
| Executing third-party HTML/CSS/JS | **Not done** |
| Changes to IMAGE/VIDEO/GIF/Information playback | **Not done** |

Conceptual future shape:

```text
CONTENT
  └── EXPERIENCE          ← category (future)
        └── HTML_APP      ← kind (future — NOT in CONTENT_TYPES today)
```

Current `CONTENT_TYPES` remain: IMAGE, VIDEO, TEXT, NOTICE, EVENT, NEWS, QR_CODE, CLOCK  
(GIF is IMAGE + MIME — unchanged.)

---

## 2. Trust Model

| Component | Classification |
|-----------|----------------|
| Vitrine360 Admin + API + Player host | **TRUSTED** |
| Device Runtime Policy / Fullscreen / Orientation controllers | **TRUSTED** (host) |
| Experience Package (HTML/CSS/JS/assets) | **UNTRUSTED / SEMI-TRUSTED** |

**Rule:** Never treat Experience JavaScript as application code. Never grant it application credentials by default.

---

## 3. Package Model

Conceptual package (not implemented):

```text
experience.zip
├── manifest.json
├── index.html          ← entrypoint (typical)
├── styles.css
├── app.js
└── assets/
    └── …
```

### Experience (identity)

Logical product owned by a **tenant/workspace**: stable `id`, human `name`, optional description.

### Experience Package (artifact)

Immutable versioned blob: zip (or equivalent) with manifest + assets. Multiple versions may coexist.

### Experience Manifest

Machine-readable contract inside the package (see §4).

### Experience Runtime (future)

Host subsystem that validates, sandboxes, loads, and stops Experiences. **Does not exist yet.**

### Experience Permissions / Capabilities / Network Policy / Limits / Storage Boundary / Security Boundary

Defined as contracts below; enforced only in future phases.

---

## 4. Manifest (conceptual contract)

```jsonc
{
  "id": "exp_…",
  "version": "1.2.0",
  "name": "Product Finder",
  "entrypoint": "index.html",
  "assets": [{ "path": "app.js", "sha256": "…" }],
  "dependencies": [],
  "capabilities": ["TOUCH", "NETWORK"],
  "permissions": [],           // admin-granted set resolved at runtime — not self-granted
  "networkPolicy": "ALLOWLIST",
  "networkAllowlist": ["https://api.example.com"],
  "offlineRequirements": "OFFLINE_PREFERRED",
  "runtimeLimits": {
    "maxPackageBytes": 5242880,
    "maxAssetBytes": 10485760,
    "maxStorageBytes": 1048576,
    "maxLifetimeMs": 3600000
  }
}
```

Fields are **PROPOSED ONLY** — no Zod schema enforced in product code in this phase.

---

## 5. Sandbox

### Candidate: sandboxed iframe

| Attribute / concern | Guidance |
|---------------------|----------|
| `sandbox` (default empty) | Maximum restriction — no scripts |
| `allow-scripts` | Required for HTML_APP JS; **does not** imply host access if origin is opaque/isolated |
| `allow-same-origin` | **Dangerous with `allow-scripts`** if iframe can reach host origin — can read cookies/DOM/storage of that origin |
| `allow-forms` | Deny unless product requires forms |
| `allow-downloads` | Deny by default |
| `allow-popups` / `allow-popups-to-escape-sandbox` | Deny by default (T7/T8) |
| `allow-top-navigation*` | Deny by default (T7) |
| `allow-modals` | Deny unless required |
| `allow` (Permissions Policy) | Explicit; no camera/mic/fullscreen without admin + device capability |
| Camera / microphone | Deny by default |
| Fullscreen / pointer lock | Host-owned (FullscreenController); Experience may *request* via bridge later |
| Storage | Prefer isolated origin; never primary Player IndexedDB |
| Network | Deny by default; see §9 |

### Dangerous configuration (must not ship)

```html
<!-- DO NOT USE as production default -->
<iframe sandbox="allow-scripts allow-same-origin" src="/same-origin-experience">
```

If the iframe document is same-origin with the Player (or shares cookies), untrusted script can escape the intended sandbox.

---

## 6. Origin

### Architectural decision

**Prefer a dedicated Experience origin** (subdomain or object-storage HTTPS origin), loaded into a sandboxed iframe on the Player page.

| Option | Verdict |
|--------|---------|
| Dedicated subdomain / CDN / R2 public origin | **Preferred** — clear isolation, CSP, caching, integrity |
| Opaque origin sandbox (`sandbox` without `allow-same-origin`) | Acceptable for constrained prototypes |
| `srcdoc` / `blob:` / `data:` | **Not** long-term default (integrity, CSP, debugging, size) |
| Same-origin Player path | **Rejected** as default |
| Inject into React tree | **Rejected** |

Rationale: convenience of same-origin packaging is outweighed by token/DOM/storage theft risk (T2–T5, T13).

---

## 7. Capabilities

Declared by package / detected on device / gated by admin:

| Capability | Meaning |
|------------|---------|
| TOUCH | Touch input |
| POINTER | Mouse / pointer |
| KEYBOARD | Keyboard-like |
| CAMERA | Camera device |
| MICROPHONE | Microphone |
| NETWORK | Outbound network (further constrained by network policy) |
| OFFLINE | May run without network |
| FULLSCREEN | May *request* fullscreen via host |
| ORIENTATION | May *request* orientation lock via host |

**Declared ≠ available ≠ allowed.**

Future effective capability:

```text
Requested (manifest)
  ∩ Device capability (probe)
  ∩ Admin permission
  = Effective capability
```

Host already probes many of these (RUNTIME-POLICY-03). Experience must not bypass host controllers for fullscreen/orientation.

---

## 8. Permissions

| Concept | Owner |
|---------|--------|
| Capability | What the device/runtime *can* do |
| Permission | What admin *allows* this Experience (or tenant policy) to do |

Example: Device `CAMERA=true` does **not** imply Experience may use camera.

---

## 9. Network Policy

| Mode | Meaning |
|------|---------|
| `NONE` | No outbound fetch/XHR/WebSocket from Experience |
| `SAME_ORIGIN` | Only Experience origin (usually useless if opaque) |
| `ALLOWLIST` | Explicit HTTPS hosts only |
| `FULL_NETWORK` | Unrestricted — **discouraged**; admin-only, high risk |

**Default: DENY (`NONE`).** Arbitrary network access is T6.

Enforcement mechanisms (future): CSP `connect-src`, service worker / proxy allowlist, bridge-mediated fetch — choose in implementation ADR; principle is deny-by-default.

---

## 10. Storage

| Store | Experience access |
|-------|-------------------|
| Player primary IndexedDB (`v360-*`) | **Forbidden** |
| Application `localStorage` / cookies | **Forbidden** |
| Experience origin storage | Allowed within quota (`runtimeLimits.maxStorageBytes`) |
| Runtime Cache / media blobs | **Forbidden** (host-only) |

Boundary name: **Experience Storage** ≠ **Vitrine360 Runtime Cache**.

---

## 11. Device identity

Experience **must never** receive:

- Device Bearer Token  
- JWT / session cookies  
- R2 signing credentials  

Future identity: controlled bridge methods (e.g. `GET_CONTEXT` returning non-secret display/locale/tenant-public ids only). Documented requirement — **not implemented**.

---

## 12. API Bridge (principles only)

Future pattern:

```text
Experience  --postMessage-->  Vitrine360 controlled bridge
```

Candidate methods (allowlist):

- `GET_CONTEXT`, `GET_TIME`, `GET_LOCALE`, `GET_DISPLAY_INFO`  
- `GET_ALLOWED_CAPABILITIES`  
- `REQUEST_FULLSCREEN`, `REQUEST_ORIENTATION` → host controllers  
- `SEND_EVENT` (telemetry / analytics sink)  

Principles:

- Allowlist methods only  
- Schema validation (Zod)  
- Origin + `event.source` validation  
- Rate limits  
- No arbitrary RPC / no admin API passthrough  
- No raw token fields in responses  

---

## 13. postMessage security

Future rules:

1. Validate `event.origin` against expected Experience origin  
2. Validate `event.source` is the sandbox window  
3. Validate message schema; reject unknown methods  
4. No `*` targetOrigin for privilege messages  
5. No `eval` / dynamic code from message payload  
6. No command that returns secrets  

---

## 14. CSP strategy

Experience documents (on Experience origin) should ship CSP. Baseline discussion:

| Directive | Direction |
|-----------|-----------|
| `default-src` | `'none'` then open minimally |
| `script-src` | self + hashed/nonced package scripts; **avoid `unsafe-eval`** |
| `style-src` | self; `unsafe-inline` only if unavoidable (document risk) |
| `img-src` / `media-src` / `font-src` | self + allowlisted CDNs |
| `connect-src` | align with network policy (default none) |
| `frame-src` / `object-src` | `'none'` for Experience child frames unless justified |
| `base-uri` | `'self'` or `'none'` |
| `form-action` | `'none'` or allowlist |

Player host page CSP (future) should restrict `frame-src` to Experience origins only.

---

## 15. Resource limits (contractual targets)

| Limit | Suggested starting target (tunable) |
|-------|--------------------------------------|
| Package size | 5 MiB |
| Total uncompressed assets | 10 MiB |
| Experience storage quota | 1 MiB |
| Lifetime per activation | 60 min (or playlist item duration) |
| Network requests / min | low fixed cap |
| Concurrent Experiences | 1 active per Player viewport |
| iframe size | Player viewport bounds |
| CPU / memory | soft monitor + kill on ERROR (future) |

**Not enforced in this phase.**

---

## 16. Lifecycle

```text
LOAD → INIT → READY → ACTIVE → PAUSED → STOPPING → STOPPED
                                    ↘ ERROR
```

Future host flow:

```text
Manifest → Package validation → Sandbox creation → Load → Init → Ready → Active → Stop
```

Playback priority remains: **host Passive playlist must not be corrupted by Experience ERROR**.

---

## 17. Offline

Manifest metadata only (future):

| Value | Meaning |
|-------|---------|
| `OFFLINE_REQUIRED` | Must run from local package cache |
| `OFFLINE_PREFERRED` | Prefer cache; online OK |
| `ONLINE_REQUIRED` | Needs network (align with network policy ≠ NONE) |

No Experience caching implemented in this phase.

---

## 18. Integrity

- SHA-256 over package and/or each asset listed in manifest  
- Do not trust filename alone  
- Do not execute before integrity + tenant validation (future)  

---

## 19. Multi-tenancy

Every future relation must carry:

`tenantId` + `experienceId` (+ `version`) + `deviceId` (when assigned)

**Never:** Tenant A Experience → Tenant B Device without explicit authorization.

Aligns with ADR-005 / existing device-content assignment patterns.

---

## Additional models

### Versioning

- `id` = Experience identity  
- `version` = immutable package revision  
- Multiple versions may exist; Device assignment pins a version  

### Device compatibility (future)

```text
Experience requirements
  + Device capabilities
  + Runtime capabilities
  + Policy / permissions
  = Effective Experience Runtime
     or NOT_COMPATIBLE
```

Do not partially execute incompatible Experiences without an explicit product decision.

### Admin control plane (future)

Admin configures capabilities, permissions, network, activation — **not in this phase**.

### Existing media runtime

IMAGE / VIDEO / GIF / Information types unchanged. Experience Runtime must not be inserted into current `DisplayEngine` path until a dedicated implementation phase.

### Proposed schema (PROPOSED ONLY — no migration)

```text
experiences (
  id, tenant_id, name, created_at, …
)
experience_versions (
  id, experience_id, version, package_sha256, package_url, manifest_json, …
)
experience_assignments ( … device or playlist binding … )
```

**Do not run migrations in this phase.**

---

## Threat Model

| ID | Threat | Mitigation direction |
|----|--------|----------------------|
| T1 | XSS against Admin | CSP, sanitization, no Experience code in Admin |
| T2 | Experience accessing application DOM | Origin isolation + sandbox; no same-origin scripts |
| T3 | Token theft | Never inject Device Bearer / JWT into iframe |
| T4 | Cookie theft | Opaque / separate origin; no `allow-same-origin` with host |
| T5 | Tenant data exfiltration | Tenant scope + network allowlist + bridge deny |
| T6 | Arbitrary network access | Default `NONE`; CSP `connect-src` |
| T7 | Malicious redirects | No top-navigation; no untrusted `location` privileges |
| T8 | Popup abuse | No `allow-popups` by default |
| T9 | Resource exhaustion | Size / lifetime / concurrency limits |
| T10 | Malicious package | Integrity SHA-256 + admin review + deny-by-default perms |
| T11 | Compromised dependency | Lockfile / vendored assets inside package; no CDN `unsafe-eval` |
| T12 | postMessage abuse | Origin/source/schema allowlist |
| T13 | Storage leakage | Separate Experience storage; no Player IndexedDB |
| T14 | Cross-tenant execution | tenantId checks on assign/load |

---

## Future Runtime (deferred)

Implementation phases (suggested naming only):

1. RUNTIME-EXPERIENCE-02 — Manifest schema + package validation (still no execute)  
2. RUNTIME-EXPERIENCE-03 — Sandbox host + CSP + origin  
3. RUNTIME-EXPERIENCE-04 — Bridge allowlist  
4. RUNTIME-EXPERIENCE-05 — Content enum + playback integration  
5. Physical / Hisense validation — separate evidence  

---

## Deferred implementation checklist

- [ ] No HTML_APP enum  
- [ ] No iframe executor  
- [ ] No functional postMessage bridge  
- [ ] No real permissions enforcement  
- [ ] No package upload  
- [ ] Design → Threat model → Boundary → Contract → ADR **done**  
- [ ] Implementation **later**  

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-001.md`  
- Checklist: `docs/evidence/runtime-experience-01/ARCHITECTURE-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-01`
