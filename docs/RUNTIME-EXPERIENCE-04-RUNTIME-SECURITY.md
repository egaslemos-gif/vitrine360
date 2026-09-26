# Vitrine360 — RUNTIME-EXPERIENCE-04  
# Controlled Experience Runtime Security Design

**Date:** 2026-09-23  
**Status:** RUNTIME SECURITY DESIGN VALIDATED (design only)  
**Depends on:** EXPERIENCE-01 … 03  
**ADR:** [ADR-EXPERIENCE-004](./adr/ADR-EXPERIENCE-004.md)

**Not claimed:** Experience Runtime · iframe · bridge · HTML_APP · upload · Player integration · PRODUCTION / PHYSICAL VALIDATED

---

## 0. Design question

> How can Vitrine360 eventually run an Experience without turning third-party content into privileged application code?

**Answer (design):** execute only inside a **dedicated Experience origin** + **sandboxed iframe** + **deny-by-default CSP / Permissions-Policy**, with a **strictly allowlisted postMessage bridge**, after **admission control** that treats VALID ≠ AUTHORIZED ≠ EXECUTABLE.

```text
PACKAGE ≠ TRUST
VALID ≠ AUTHORIZED
AUTHORIZED ≠ EXECUTABLE
EXECUTABLE ≠ PRIVILEGED
```

---

## 1. Trust model

### TRUSTED ZONE (Vitrine360)

| Area | Notes |
|------|-------|
| Application shell / Admin / Player host | Trusted control plane |
| Server, APIs, database | Trusted |
| Device identity, authn/authz | Trusted |
| Storage credentials (R2, etc.) | Trusted — never forwarded |
| Scheduler, manifest resolver | Trusted |
| Device Runtime Policy (01–08B) | Trusted host controllers |

### UNTRUSTED / SEMI-TRUSTED ZONE (Experience)

| Area | Notes |
|------|-------|
| HTML / CSS / JS | Untrusted executable content |
| Bundled assets / declared dependencies | Semi-trusted at best |
| External resources (if authorized) | Untrusted; policy-gated |

An Experience is **never** trusted solely because it was:

- created by an admin;  
- validated;  
- published;  
- owned by the same tenant.

**Validation ≠ trust.**

---

## 2. Security / trust boundary

```text
Vitrine360 Application (trusted)
        │
        │ controlled interface only
        ▼
Dedicated Experience Execution Context (untrusted)
```

### Experience MUST NOT be able to

| Prohibited access | Rationale |
|-------------------|-----------|
| Application cookies / JWT / Device Bearer | Credential theft (T3/T4) |
| App LocalStorage / IndexedDB / Cache Storage | Storage leakage (T13) |
| Host DOM / React tree | DOM XSS / takeover (T2) |
| Admin APIs directly | Privilege escalation |
| R2 / AUTH_SECRET / tenant secrets | Secret exfiltration (T5) |
| Mutate Player / other Devices / other tenants | Cross-tenant / lateral (T14) |

Primary boundary: **origin separation** + **iframe sandbox** + **bridge allowlist**.

---

## 3. Origin model

### Alternatives evaluated

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. Same-origin iframe** | Simple | Shares cookies/storage with app | **Reject** as default |
| **B. Same-origin + sandbox** | Extra attrs | `allow-scripts`+`allow-same-origin` can neutralize sandbox | **Reject** as default |
| **C. Dedicated subdomain** | Clear split | DNS/TLS ops | Preferred form of D |
| **D. Dedicated origin** | Strong cookie/storage isolation | Ops cost | **PREFERRED** |
| **E. Blob / data URL** | Easy load | Weak CSP/origin semantics; hard bridge trust | **Reject** default |
| **F. srcdoc** | Inline | Same-origin hazards; size limits | **Reject** default |

### Decision (preferred)

**Dedicated Experience Origin.**

Conceptual examples (not provisioned in this phase):

```text
https://experience.<trusted-domain>/
https://exp.<trusted-domain>/
```

Rules:

- Experience origin **MUST NOT** share the privileged application origin.  
- Domain/DNS/TLS are **not** implemented here.  
- `allow-scripts` + `allow-same-origin` on the **privileged** same origin is **explicitly rejected** as the default model.

---

## 4. iframe sandbox model

Sandbox is **defence in depth**, not a substitute for origin isolation.

### Principle: DENY BY DEFAULT

| Token | Default | Justification if ever enabled |
|-------|---------|-------------------------------|
| `allow-scripts` | Required for interactive HTML_APP (future) | Only inside dedicated origin |
| `allow-same-origin` | **Deny** on privileged host; only meaningful on dedicated origin | Never pair with privileged same-origin |
| `allow-forms` | Deny | Enable only if form UX is required + CSP `form-action` locked |
| `allow-popups` | Deny | Popup abuse (T8) |
| `allow-modals` | Deny | UX spoofing |
| `allow-downloads` | Deny | Drive-by download |
| `allow-top-navigation` | Deny | Top hijack (T7) |
| `allow-top-navigation-by-user-activation` | Deny by default | Rare, explicit policy only |
| `allow-pointer-lock` | Deny | Requires capability + permission |
| `allow-presentation` | Deny | Requires capability + permission |

**Critical anti-pattern:** `allow-scripts` + `allow-same-origin` in a **same-origin privileged** context can allow script to remove sandbox restrictions. Documented as **forbidden default**.

Conceptual future attribute (documentation only):

```html
<iframe
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  …>
</iframe>
```

(Exact token set finalized when origin hosting exists.)

---

## 5. Content Security Policy (conceptual)

CSP = **defence in depth**. Alone it does **not** create isolation.

### Principle: DEFAULT DENY

Conceptual Experience CSP skeleton:

| Directive | Conceptual value | Intent |
|-----------|------------------|--------|
| `default-src` | `'none'` | Default deny |
| `script-src` | `'self'` (no `'unsafe-eval'`) | No eval / Function |
| `style-src` | `'self'` (+ optional hash/nonce) | Controlled CSS |
| `img-src` | `'self'` + policy allowlist | Media |
| `media-src` | `'self'` + policy allowlist | Video/audio |
| `font-src` | `'self'` or deny | No random CDNs |
| `connect-src` | `'none'` or allowlist | Network boundary |
| `frame-src` / `child-src` | `'none'` | No nested frames by default |
| `worker-src` | `'none'` or `'self'` gated | Workers optional later |
| `object-src` | `'none'` | No object/embed |
| `base-uri` | `'none'` or `'self'` | Block base hijack |
| `form-action` | `'none'` or allowlist | Form exfil |
| `frame-ancestors` | host-only | Clickjacking of Experience |
| `navigate-to` | constrained (when supported) | Navigation boundary |

### Must block / discourage

- `object` / `embed`  
- Arbitrary frame navigation  
- Uncontrolled external scripts / connections  
- Unnecessary inline script  
- `eval`, `new Function`, dynamic code execution  

Headers are **not** shipped in this phase.

---

## 6. Permissions Policy (conceptual)

Default **deny** all powerful features:

`camera`, `microphone`, `geolocation`, `fullscreen`, `payment`, `usb`, `serial`, `bluetooth`, `clipboard-read`, `clipboard-write`, `display-capture`, …

Enable **only when**:

```text
Experience requests capability
  AND admin grants permission
  AND Device supports capability
```

Aligns with EXPERIENCE-02/03 effective capability model. Headers not implemented yet.

---

## 7. Network boundary

| Mode | Semantics |
|------|-----------|
| `NONE` | **Default.** No outbound network |
| `SAME_ORIGIN` | Only dedicated Experience origin |
| `ALLOWLIST` | Explicit HTTPS hosts only |
| `FULL_NETWORK` | Audited exception — never default |

Future Runtime applies:

```text
Experience.networkPolicy
  ∩ admin permission
  ∩ runtime/device constraints
```

### Channels to gate

`fetch`, XHR, WebSocket, WebRTC, EventSource, `<img>`, `<video>`, fonts, scripts, redirects.

### Invariant

`FULL_NETWORK` **MUST NOT** become an indirect path to private Vitrine360 APIs.

- Experience receives **no** bearer tokens.  
- Private API hosts are **not** on allowlists by default.  
- Redirects off-allowlist → deny.

---

## 8. Storage boundary

```text
Vitrine360 storage  ≠  Experience storage
```

Forbidden for Experience:

- App IndexedDB / LocalStorage / Cache Storage / cookies  

Future Experience storage (isolated by origin/context):

| Mode | Default |
|------|---------|
| `NONE` | **Yes** |
| `EPHEMERAL` | Session wipe on STOP |
| `PERSISTENT` | Requires `offlineStorage` permission + quota |

---

## 9. Navigation boundary

**Default:** Experience cannot navigate the **top-level** document.

| Vector | Default policy |
|--------|----------------|
| `target=_blank` / `window.open` | Deny (or noop + host mediation) |
| `location.assign/replace` | Contained to Experience origin only |
| Meta refresh | Deny / strip |
| Nested iframe navigation | Deny (`frame-src 'none'`) |
| External navigation | Deny unless explicit policy |
| Downloads | Deny by default |

Any escape from context must be **blocked** or **explicitly permitted**. No automatic navigation to arbitrary domains (T7).

---

## 10. Input boundary

Future inputs: `TOUCH` | `MOUSE` | `KEYBOARD` | `REMOTE` (as KEYBOARD_LIKE when indistinguishable).

Admission:

```text
Device capability ∩ Experience requested ∩ Admin permission
```

### Prefer

**A. DOM-local events inside the Experience iframe** for internal UX.

### Bridge

Host bridge only for **explicitly authorized** services (fullscreen, orientation, …) — not for raw token/device secret forwarding.

Never expose: Device Bearer, secret Device IDs, tenant credentials.

---

## 11. Fullscreen boundary

Experience **MUST NOT** call Fullscreen API freely against the host.

```text
Experience requests fullscreen
        ↓
Bridge (allowlisted method)
        ↓
Host policy (RUNTIME-POLICY-08A)
        ↓
Admin permission
        ↓
Device capability
        ↓
User / secure-context / gesture conditions
        ↓
ALLOW / DENY
```

**Request ≠ permission.** Align with FullscreenController semantics (promise ≠ actual).

---

## 12. Orientation boundary

Same pattern; integrate with RUNTIME-POLICY-08B:

```text
Experience request → Bridge → Host OrientationController
  → Device capability → Policy → ALLOW / DENY
```

Experience must not arbitrarily lock orientation without host mediation.

---

## 13. Bridge security model (postMessage)

Future **only** controlled interface: `postMessage`.

**Not implemented in this phase.**

### Mandatory principles

1. Allowlist methods  
2. Validate `event.source`  
3. Validate `event.origin` (exact; no `*`)  
4. Validate message schema  
5. Validate message version  
6. Reject unknown methods  
7. Reject malformed payloads  
8. No wildcard trust  
9. No `eval`  
10. No arbitrary RPC  
11. No DOM object references across boundary  
12. No credential forwarding  
13. Request IDs  
14. Timeouts  
15. Rate limits  
16. Cancellation  
17. Structured error responses  

### Forbidden pattern

```js
// FORBIDDEN as normal policy
window.addEventListener("message", (event) => {
  // trust event.data blindly
});
// targetOrigin = "*"  // FORBIDDEN as normal policy
```

When Experience origin is known, always use **exact** `targetOrigin`.

---

## 14. Bridge API principles (classes only)

### READ-ONLY INFORMATION (future, gated)

- Runtime status, viewport, orientation, time  
- Locale **if** permitted  

### CONTROLLED REQUESTS (future, gated)

- Fullscreen, orientation, storage, network, abstracted input  

### NEVER EXPOSE

| Forbidden | |
|-----------|-|
| Raw tokens / cookies | |
| DB access / filesystem / shell / process | |
| Arbitrary HTTP client / admin API client | |
| Server credentials | |

---

## 15. Runtime admission control

Before any future execution:

```text
Registry lookup
      ↓
Tenant check
      ↓
Version check
      ↓
Package integrity (SHA-256)
      ↓
Publication state (PUBLISHED?)
      ↓
Blocked / deprecated?
      ↓
Device compatibility
      ↓
Capabilities
      ↓
Permissions
      ↓
Network policy
      ↓
Storage policy
      ↓
Runtime policy / limits
      ↓
ADMIT / DENY
```

Any failure → **DENY** (fail closed).  
Admission ≠ successful start; still subject to load/CSP/bridge failures.

---

## 16. Lifecycle (host-side conceptual)

Align with EXPERIENCE-02 instance lifecycle:

```text
ADMITTED → LOAD → INIT → READY → ACTIVE ⇄ PAUSED → STOPPING → STOPPED
                         ↘ ERROR
```

| Phase | Host responsibility |
|-------|---------------------|
| LOAD | Fetch package bytes for dedicated origin; no execute yet |
| INIT | Create sandboxed frame; apply CSP/Permissions-Policy |
| READY | Entrypoint loaded; bridge handshake optional |
| ACTIVE | Experience visible/interactive per policy |
| PAUSED | Suspend timers/media where possible |
| STOPPING/STOPPED | Tear down frame; wipe ephemeral storage |
| ERROR | Isolate failure; never crash Player shell |

State machine **not** implemented here.

---

## 17. Failure isolation

| Failure | Required behaviour |
|---------|-------------------|
| Package corrupt / integrity fail | Deny load; stay on prior content / safe fallback |
| CSP / sandbox violation | Contained to iframe; host logs |
| Bridge protocol error | Reject message; rate-limit; optional STOP |
| Experience JS throw / hang | Watchdog → STOPPING; Player continues |
| Network policy violation | Block request; do not escalate privileges |

**Invariant:** Experience faults MUST NOT take down the trusted Player control plane.

---

## 18. Resource limits

Reuse EXPERIENCE-02 `runtimeLimits` (may be `UNSPECIFIED` until measured):

- package size, asset count  
- memory / CPU time budgets  
- network request count  
- storage bytes  
- max session seconds  

When unspecified → document only; do not invent fake hard numbers in this phase.  
Future Runtime enforces fail-closed when limits are numeric.

---

## 19. Kill switch

Multi-layer stop:

| Layer | Action |
|-------|--------|
| Admin / registry | `BLOCKED` / unpublish version |
| Device assignment | Remove Experience from playlist/schedule |
| Host runtime | Force `STOPPING` → destroy iframe |
| Bridge | Disable channel; ignore further messages |

Kill switch MUST work **without** Experience cooperation.

---

## 20. Observability

Host-only telemetry (no secrets):

- Admission deny reasons (coded)  
- Load / READY / ERROR transitions  
- Bridge reject counts / rate-limit hits  
- Capability mismatches (align RUNTIME-POLICY-07 style)  
- Kill-switch events  

Never log JWT, bearer tokens, cookies, or package source as executable dumps in client logs.

---

## 21. Offline behaviour

Align EXPERIENCE-02 offline modes:

| Mode | Runtime implication |
|------|---------------------|
| `OFFLINE_REQUIRED` | Admit only if package prepared locally; network `NONE` preferred |
| `OFFLINE_PREFERRED` | Run offline; optional online features if policy allows |
| `ONLINE_REQUIRED` | Deny admit when network requirements unmet |

No Experience-specific Service Worker in this design phase. Future SW, if any, must not widen network/storage beyond policy.

---

## 22. Tenant isolation

At every stage (admit, load, bridge, assign):

- Resolve Experience only within **requesting tenant**  
- Tenant A package MUST NOT execute for Tenant B Device  
- Bridge messages carry tenant-scoped experience identity validated by host (not trusted from iframe alone)

Cross-tenant execution = hard deny (`EXPERIENCE_BLOCKED` / equivalent).

---

## 23. Security invariants (MUST)

1. Experience code is never trusted application code.  
2. Dedicated origin preferred; privileged same-origin sandbox+scripts rejected as default.  
3. Deny-by-default: network, storage, permissions, navigation, popups.  
4. No credential forwarding across the bridge.  
5. Effective capability = Device ∩ Requested ∩ Permission.  
6. VALID ≠ AUTHORIZED ≠ EXECUTABLE ≠ PRIVILEGED.  
7. Fail closed on admission / policy / integrity errors.  
8. Kill switch does not require Experience cooperation.  
9. Experience failure cannot crash the Player shell.  
10. Tenant scope enforced at every lifecycle stage.

---

## 24. Threat model (T1–T14 mapping)

| Threat | Design control | Deferred to |
|--------|----------------|-------------|
| T1 XSS admin | Experiences never load in Admin | Continuous Admin CSP |
| T2 DOM access | Dedicated origin + sandbox + no host DOM | EXPERIENCE-05+ host |
| T3 Token theft | No tokens in Experience context / bridge | Bridge impl |
| T4 Cookie theft | Separate origin | Origin hosting |
| T5 Tenant exfil | Tenant checks + network deny default | Assign/load |
| T6 Arbitrary network | Network modes + CSP `connect-src` | Runtime enforce |
| T7 Redirects / top-nav | Navigation boundary; no `allow-top-navigation` | Sandbox attrs |
| T8 Popups | Deny `allow-popups` | Sandbox attrs |
| T9 Exhaustion | Runtime limits + watchdog | Runtime |
| T10 Malicious package | Validator + admission integrity | Upload/registry |
| T11 Compromised deps | Prefer bundled; CSP script-src | Dep policy |
| T12 postMessage abuse | Origin/source/schema allowlist | Bridge phase |
| T13 Storage leakage | Storage NONE + origin isolation | Storage impl |
| T14 Cross-tenant | Admission tenant check | Persistence/assign |

---

## 25. Phased implementation boundary

Suggested order (**not** implemented now):

| Phase (future) | Deliverable |
|----------------|-------------|
| EXPERIENCE-05 | Origin hosting + package serving (still no Player wire) |
| EXPERIENCE-06 | Sandboxed iframe host + CSP/Permissions-Policy headers |
| EXPERIENCE-07 | Bridge v1 (allowlisted methods only) |
| EXPERIENCE-08 | Admission wired to registry + Device policy |
| EXPERIENCE-09 | Content enum / playback integration (separate ADR) |

This phase (04): **design only**.

---

## 26. Non-goals (confirmed absences)

- No HTML_APP / CONTENT_TYPES change  
- No Experience Runtime / iframe / sandbox / bridge **code**  
- No package execution  
- No DB migrations / Experience API routes  
- No playback / scheduler / Device Runtime mutations  

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-004.md`  
- Checklist: `docs/evidence/runtime-experience-04/RUNTIME-SECURITY-CHECKLIST.md`  
- Validation: `npm run test:runtime-experience-04`
