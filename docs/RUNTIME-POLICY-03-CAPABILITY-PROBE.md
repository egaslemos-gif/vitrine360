# Vitrine360 — RUNTIME-POLICY-03 Capability Probe

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** RUNTIME-POLICY-01 / 02  

---

## 1. Contract

`DetectedRuntimeCapabilities` (domain) — browser facts:

`video · image · gif · touch · pointer · keyboard · remote · fullscreen · orientation · network · serviceWorker · indexedDB`

**Not** `RuntimeCapabilities` from `passive.ts` (product flavour: autoplay, touchNavigation, …).

Probe module: `src/player/runtime/capabilities.ts` → `probeRuntimeCapabilities()`.

---

## 2. Detection rules

| Cap | Rule |
|-----|------|
| video | `HTMLVideoElement` + `canPlayType` non-empty for common types (basic support, not codec matrix) |
| image / gif | `HTMLImageElement` present (GIF = native `<img>`) |
| touch | `navigator.maxTouchPoints > 0` |
| pointer | `window.PointerEvent` |
| keyboard | `addEventListener` available |
| remote | **always false** without vendor evidence |
| fullscreen | `requestFullscreen` / webkit / ms **presence** — API **not called** |
| orientation | `screen.orientation` **presence** — lock **not called** |
| network | `typeof navigator.onLine === "boolean"` (hint API, not server reachability) |
| serviceWorker | `"serviceWorker" in navigator` — no register |
| indexedDB | `"indexedDB" in window` — no open |

Environment metadata (UA fragile TV, secureContext, language) is **separate** from capability booleans. Hisense UA does **not** force `fullscreen: false`.

---

## 3. Browser limitations

- `navigator.onLine` is advisory.  
- Fullscreen capability ≠ user-activation success.  
- Orientation API ≠ lock works.  
- Headless Chromium ≠ Hisense/VIDAA.

---

## 4. React integration

`PlayerRuntimeShell` runs probe once on mount; publishes `window.__v360_runtime_capabilities` (no secrets).  
Diag overlay (`D`) shows `formatCapabilitiesDiagnostics`.  
Probe failure is non-fatal.

---

## 5. Legacy strategy

ES5 mirror in `public/tv.js` (`probeLegacyCapabilities`) writes the same global key with `source: "legacy-tv.js"`.  
Not shared TS bundle — documented dual implementation with identical contract.

---

## 6. Security

`assertNoAuthTokenExposure` on snapshot. No tokens, cookies, tenant IDs, or storage credentials in probe output.

---

## 7. Diagnostics

Safe boolean rows only. Example: `video: ✓ · remote: ✗ · …`

---

## 8. Tests

| Suite | Command |
|-------|---------|
| CAP-001…017 | `npm run test:runtime-policy-03` |
| Live | `npm run test:capability-live` |

Evidence: `docs/evidence/runtime-policy-03/CAPABILITY-E2E-RESULTS.md`

---

## 9. Physical validation

**HISENSE CAPABILITY PROBE = NOT EXECUTED** (device offline / not observed).  
Do not substitute desktop Chromium for Hisense claims.

---

## 10. Known limitations

- Dual React/Legacy detectors (no TS in tv.js).  
- No resolveRuntimePolicy wiring yet (POLICY later).  
- No Fullscreen/Orientation feature behaviour.
