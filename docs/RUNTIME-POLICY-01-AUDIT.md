# Vitrine360 — RUNTIME-POLICY-01 Audit

**Date:** 2026-09-22  
**Phase:** Architecture hardening (contracts only)  
**Status:** APPROVED FOR IMPLEMENTATION  
**Not claimed:** PRODUCTION VALIDATED  

GIF-011 physical remains **BLOCKED** (Hisense OFFLINE) — unchanged this phase.

---

## 0. Decision: no `DeviceRuntimeConfig` table (yet)

| Layer | Lives where today | Persist? |
|-------|-------------------|----------|
| **A. Device configuration** | `devices.*` (`displayType`, `interactionMode`, `orientation`, timezone, name, location, `currentPlaylistId`, status) | Yes (admin) |
| **B. Runtime policy** (desired behaviour) | Conceptual + `src/domain/runtime-policy.ts`; **defaults derived from Device config** | **Not yet** — avoid new table until Cursor/Capabilities/Presentation need durable admin knobs |
| **C. Runtime capabilities** | Detected at boot/session (`DetectedRuntimeCapabilities`) | **No DB** — runtime facts |
| **D. Runtime state** | In-memory Player (`player-app` / `tv.js`); partial mirror in `devices.playerState` | Ephemeral (heartbeat snapshot only) |
| **E. Telemetry** | Heartbeat / activity logs / future counters | Existing channels only; no new observability platform |

**Rationale:** Policy desire ≠ capability ≠ state. A premature `DeviceRuntimeConfig` would conflate them and force schema before Cursor/Fullscreen contracts settle.

---

## 1. Current architecture

```text
Admin Device config
       │
       ▼
Manifest / Sync / Schedule / Runtime Cache   ← unchanged (hard constraint)
       │
       ├── /player  → React Passive Runtime (PlayerRuntimeShell + player-app)
       └── /tv.html → legacy tv.js (Hisense/VIDAA redirect from /player)
```

- ADR-006: Passive vs Interactive Runtime; MVP = PASSIVE only.  
- Device already stores `display_type`, `interaction_mode`, `orientation`.  
- Existing `RuntimeCapabilities` in `passive.ts` = **product flavour flags** (autoplay, touchNavigation) — **not** browser capability probe. New name: `DetectedRuntimeCapabilities`.

---

## 2. Domain policy

Conceptual model (`DomainRuntimePolicy`):

| Axis | Values |
|------|--------|
| Presentation | FULLSCREEN \| WINDOWED \| AUTO |
| Cursor | HIDDEN \| AUTO_HIDE \| VISIBLE |
| Input | REMOTE \| KEYBOARD \| MOUSE \| TOUCH \| **KEYBOARD_LIKE** |
| Interaction | PASSIVE \| INTERACTIVE |
| Orientation | AUTO \| LANDSCAPE \| PORTRAIT |

Defaults: AUTO / AUTO_HIDE / KEYBOARD_LIKE+MOUSE+TOUCH / PASSIVE / AUTO.

Derived from Device without new table via `defaultPolicyFromDeviceConfig()`.

---

## 3. Resolved policy

`resolveRuntimePolicy({ tenantId, deviceId, policy, capabilities, environment })` → `ResolvedRuntimePolicy` with:

- resolved fields  
- `fallbacks[]` `{ field, requested, resolved, reason }`  
- `diagnostics[]`  

**Precedence:**

1. Explicit domain policy  
2. Runtime capability  
3. Environment / browser constraint (`fragileSmartTv`, user activation)  
4. Safe fallback (e.g. FULLSCREEN → WINDOWED)

Incompatibilities are **visible**, not silent.

---

## 4. Runtime capabilities

```ts
DetectedRuntimeCapabilities {
  video, image, gif, touch, pointer, keyboard, remote,
  fullscreen, orientation, network, serviceWorker, indexedDB
}
```

| Rule | |
|------|--|
| Meaning | Runtime **detected** support |
| Not | Admin desire (`policy.fullscreen` ≠ `capabilities.fullscreen`) |
| When | Boot + optional refresh on visibility/online |
| Where | Client runtime only (React probe module future; not wired this phase) |
| Store | Memory (optional session diagnostics); **no DB table** |
| Expose | Diagnostics / diag overlay — never tokens |

`remote: true` only with positive evidence; otherwise key events → `KEYBOARD_LIKE`.

---

## 5. Runtime state

Examples: `isPlaying`, `currentContentId`, `currentManifestVersion`, `syncState`, `networkState`, `cursorVisible`, `fullscreenActive`, `orientationActual`, `lastInputAt`, `lastInputClass`.

**Not** admin configuration. Heartbeat may snapshot a subset (`playerState`) — telemetry-ish, not policy.

---

## 6. Telemetry

Contract only: `lastHeartbeatAt`, `lastSyncAt`, `syncDurationMs`, `assetDownloadFailures`, `runtimeErrors`, `inputEventCount`, `fullscreenFailures`.

Today: heartbeat updates `lastSeenAt` + `playerState` JSON. No new observability stack in POLICY-01.

---

## 7. React runtime

| Concern | Location | Behaviour |
|---------|----------|-----------|
| Shell / viewport | `PlayerRuntimeShell` | `html.player-runtime`; fixed viewport; visualViewport fit |
| CSS | `globals.css` | overflow hidden, user-select none, **touch-action: none**; `.player-media { pointer-events: none }` — **no** `cursor: none !important` on `*` |
| Cursor | `player-app.tsx` | Idle hide on `rootRef.style.cursor`; show on mousemove/mousedown/touchstart/keydown; **3000 ms** |
| Fullscreen API | — | **Not called** |
| PWA | `player-manifest.webmanifest` | `"display": "fullscreen"`, `"orientation": "landscape"` |
| Fragile TV | boot redirect → `/tv.html` | UA / `?tv=1` |
| Input | keydown for diag/reset; cursor listeners | No REMOTE discrimination |
| Orientation lock | — | **Not called** |
| IndexedDB / SW | Runtime Cache + `sw-register` | Desktop path; fragile TVs redirected |

---

## 8. Legacy runtime (`public/tv.js`)

| Concern | Behaviour |
|---------|-----------|
| Cursor | `document.body.style.cursor` none/auto; same events; **3000 ms** |
| Fullscreen API | **Not called**; CSS full-bleed only |
| “Fullscreen” comment | Hidden `<video>` Hisense white-plane quirk — layout, not Fullscreen API |
| Orientation | None |
| IndexedDB | Limited / prepareItems; fragile platforms may skip SW |
| Input | Same event set as React |

---

## 9. Hisense / VIDAA constraints

| Item | Status |
|------|--------|
| Physical GIF-011 | **BLOCKED** (device OFFLINE) — not this phase |
| Fullscreen API | **Unknown** on Sraf — do **not** invent Hisense-specific fallback claiming support |
| PWA display fullscreen | Likely **N/A** / ignored on Sraf browser |
| Cursor | Inline body style works in prior sessions; no `!important` CSS fight today |
| Orientation.lock | Treat **unsupported** until evidenced |
| SW / IDB | Fragile UA → prefer `tv.html` path |

---

## 10. Android / Chrome constraints

| Item | Note |
|------|------|
| Fullscreen API | Needs **user activation**; kiosk/PWA may already be chrome-less via manifest |
| PWA `display: fullscreen` | ≠ `requestFullscreen()` |
| Orientation.lock | Often needs fullscreen + secure context; may fail silently |
| Touch / pointer | `maxTouchPoints`, Pointer Events — probe later |
| Cursor AUTO_HIDE | Works where mouse exists; irrelevant on pure leanback |

---

## 11. Fullscreen model

Two **different** mechanisms:

1. **PWA** `manifest.display = "fullscreen"` / standalone — install/launch chrome policy.  
2. **Fullscreen API** `document.documentElement.requestFullscreen()` — needs gesture; exit via Escape / `fullscreenchange`.

POLICY-01: document only; **do not** call Fullscreen API.  
Resolution: requested FULLSCREEN + `capabilities.fullscreen=false` → resolved WINDOWED + diagnostic.

---

## 12. Cursor model

**Desired:** IDLE hidden → input visible → 3s idle hidden (`AUTO_HIDE`).

**Actual control:**

| Layer | Controls cursor? |
|-------|------------------|
| `globals.css` `html.player-runtime` | **No** cursor rule (audit myth of `* { cursor:none !important }` — **not present**) |
| React `rootRef.style.cursor` | Yes |
| Legacy `document.body.style.cursor` | Yes |

**Conflict risk (documented, not fixed this phase):**

- React sets cursor on an inner/root div; if children or `body` don’t inherit as expected, cursor may stay visible on chrome outside `rootRef`.  
- Legacy sets `body` — broader.  
- Pairing screen also forces `cursor: "none"` inline.  
- `touch-action: none` + `pointer-events: none` on media: touch still hits window listeners for cursor, but media won’t receive pointer for future INTERACTIVE without policy change.

---

## 13. Orientation model

| Kind | Source |
|------|--------|
| Requested | Policy / Device `orientation` column / PWA manifest `landscape` |
| Actual | `screen.orientation` / `window.orientation` / resize — probe later |

Do **not** call `screen.orientation.lock()` in POLICY-01. Unsupported → resolve AUTO.

---

## 14. Input model

Observable events: `pointer*`, `mousemove`, `mousedown`, `touchstart`, `keydown`, `keyup`.

| Event | Class |
|-------|--------|
| touch* | TOUCH |
| mouse/pointer | MOUSE |
| key* | **KEYBOARD_LIKE** (not REMOTE) |

Remote IR often aliases keyboard — **no reliable discrimination** without vendor APIs → `KEYBOARD_LIKE`.

---

## 15. Interaction model

| Policy | Meaning |
|--------|---------|
| PASSIVE | Autoplay signage; no required viewer interaction (shipped) |
| INTERACTIVE | May accept input for interactive experiences (**not** HTML_APP / Experience Runtime this phase) |

Map Device `interaction_mode` TOUCH/QR/HYBRID → policy INTERACTIVE for future; UI must not enable interactive shells until a later phase.

---

## 16. Security boundaries

Runtime Policy / Capabilities / State / Telemetry surfaces **must not** include:

- device bearer / pairing secrets  
- AUTH_SECRET / password hashes  
- admin session cookies  
- cross-tenant device config  
- raw access to admin IndexedDB / primary app secrets for future HTML_APP sandboxes  

Enforced in contracts via `assertNoAuthTokenExposure` + `assertTenantDeviceScope`.  
Future INTERACTIVE/HTML_APP: separate document; no iframe/sandbox work in POLICY-01.

---

## 17. Future implementation order (revised)

Audit dependencies → recommended order:

1. **Cursor contract hardening** (align React target element with body/html; document CSS; keep 3s AUTO_HIDE)  
2. **Capability Probe** (client module; diagnostics; no DB)  
3. **Wire `resolveRuntimePolicy`** into React (+ later legacy) with visible diagnostics  
4. **Presentation mode** (WINDOWED vs chrome-less layout) **before** Fullscreen API  
5. **Fullscreen API** (Chrome/Android + user activation; record failures)  
6. **Orientation** (detect actual; lock only where evidenced)  
7. **Input normalization** (KEYBOARD_LIKE / TOUCH / MOUSE)  
8. **Interactive runtime** (ADR-006) — still after security sandbox design  

Defer: HTML_APP, Experience Package, iframe sandbox, DeviceRuntimeConfig table until (1)–(3) prove need for durable admin knobs.

---

## 18. Known limitations

- Dual players (React vs `tv.js`) — contracts must stay dual-aware.  
- Hisense Fullscreen/Orientation = **unknown** (no physical pass this phase).  
- Existing `passive.ts` `RuntimeCapabilities` name collision — use `DetectedRuntimeCapabilities` for probes.  
- Device `orientation` / `interaction_mode` already persisted as **config**, not full Runtime Policy.  
- No product Fullscreen/Orientation/Interactive implementation in this phase.

---

## Tests

`npm run test:runtime-policy-01` — POLICY-001 … POLICY-012.

Code: `src/domain/runtime-policy.ts`, `scripts/test-runtime-policy-01.ts`.
