# ADR-EXPERIENCE-001 — Interactive Experience Security Boundary

**Status:** Accepted (architecture only) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-01  
**Supersedes:** nothing  
**Related:** ADR-005 (multi-tenant), ADR-006 (Player Runtime), RUNTIME-POLICY-01…08B

---

## Context

Vitrine360 will eventually support interactive digital experiences:

```text
CONTENT
  └── EXPERIENCE
        └── HTML_APP   ← future content kind (NOT implemented in this phase)
```

An Experience Package is HTML/CSS/JavaScript authored outside the Vitrine360 application codebase. Once executed on a Device Player, that code becomes **untrusted / semi-trusted executable content**.

The platform already has:

- Device Runtime Policy (capability probe, resolve, fullscreen, orientation)
- Passive Media / Information playback
- Tenant isolation, device bearer auth, R2 media storage

Before any Experience Runtime can load, validate, or execute package code, the security boundary, trust model, and contracts must be fixed. Implementing a sandboxed iframe or postMessage bridge *before* that design would create irreversible attack surface.

**This ADR does not authorize implementation of HTML_APP, iframe executors, package upload, or API bridges.**

---

## Decision

### 1. Trust model

| Layer | Trust |
|-------|--------|
| Vitrine360 Application (Admin + Player host) | **TRUSTED** |
| Experience Package (HTML/CSS/JS + assets) | **UNTRUSTED / SEMI-TRUSTED** |

Experience JavaScript must never be treated as application code.

### 2. Security boundary

```text
Vitrine360 (trusted host)
       │
       │ controlled interface only (future postMessage bridge)
       ↓
Experience Sandbox (untrusted)
       ├── HTML
       ├── CSS
       └── JavaScript
```

The Experience **must not** obtain direct access to:

- application cookies / JWT / Device Bearer Token  
- tenant secrets / R2 credentials / `AUTH_SECRET`  
- admin APIs / application DOM / React tree  
- primary IndexedDB / internal Runtime State store  

### 3. Primary sandbox candidate

**Sandboxed iframe** is the primary candidate for the future Experience Runtime.

Default posture: **deny by default**. Prefer an **opaque origin** sandbox (`sandbox` **without** `allow-same-origin` when scripts are needed, or with carefully separated origins).

**Forbidden without explicit ADR revision:** combining `allow-scripts` + `allow-same-origin` on an iframe that can reach host origin (or host-equivalent storage). That combination effectively lets untrusted script escape the sandbox into the host security context.

### 4. Origin isolation (chosen direction)

**Decision:** Experiences must run under a **dedicated origin distinct from the Player application origin**, delivered as static package assets (preferred: dedicated subdomain or object-storage origin with tight CSP), loaded into a sandboxed iframe.

**Rejected for production default:**

- `srcdoc` / `blob:` / `data:` as sole long-term strategy (CSP / storage / integrity / caching trade-offs)  
- same-origin iframe with only cosmetic sandboxing  
- injecting Experience scripts into the Player React tree  

Opaque-origin sandbox remains acceptable for early prototypes **if** no host cookies/storage are shared and the bridge is deny-by-default.

### 5. Contracts before code

Future work must introduce, in order:

1. Package + Manifest contracts (this phase — conceptual)  
2. Integrity (SHA-256) + tenant scoping  
3. Sandbox executor + CSP  
4. Controlled API bridge (allowlisted methods only)  
5. Admin permission / network policy control plane  
6. Only then: Content enum / schema / playback integration  

### 6. Explicit non-goals of this phase

- No `HTML_APP` in `CONTENT_TYPES`  
- No Experience table / migration  
- No iframe executor, postMessage bridge, package upload  
- No change to IMAGE / VIDEO / GIF / Information playback  

---

## Alternatives considered

| Alternative | Why not (for now) |
|-------------|-------------------|
| Execute Experience JS in Player main world | Total trust collapse; DOM + token theft |
| Web Worker only | No DOM/UI for HTML_APP; incomplete UX |
| Native WebView (APK) per Experience | Out of platform scope; Hisense/firmware changes forbidden |
| `eval` / dynamic `Function` of package source | No origin boundary; CSP nightmare |
| Same-origin iframe + `allow-scripts allow-same-origin` | Classic sandbox bypass |
| Defer all design until first HTML_APP PR | Security bolted on after attack surface exists |

---

## Security consequences

- Attack surface for untrusted JS is **deferred** until contracts + sandbox exist.  
- Threat model (T1–T14) in RUNTIME-EXPERIENCE-01 becomes the checklist for future PRs.  
- Device Bearer Token remains host-only; Experiences get identity only via a future controlled bridge (never raw tokens).  

## Operational consequences

- Product can plan Experience packaging, admin permissions, and offline metadata without shipping runtime risk.  
- Media / schedule / runtime-policy work continues without Experience coupling.  

## Future work (ordered)

1. Experience Manifest schema (Zod) — still no executor  
2. Package validation service (size, SHA-256, tenant)  
3. Dedicated Experience origin + CSP templates  
4. Sandboxed iframe host (Player) with deny-by-default sandbox  
5. postMessage bridge allowlist  
6. Admin permission UI + network allowlist  
7. Content type / DB migration (separate ADR)  
8. Physical device validation (incl. Hisense) — never assumed from Chromium  

---

## References

- `docs/RUNTIME-EXPERIENCE-01-ARCHITECTURE.md`  
- `docs/evidence/runtime-experience-01/ARCHITECTURE-CHECKLIST.md`  
- RUNTIME-POLICY-03…08B (capabilities, fullscreen, orientation — host-owned; Experiences may only *request* via bridge later)
