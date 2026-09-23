# Vitrine360 — RUNTIME-POLICY-04 Resolution Wiring

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** POLICY-01 / 02 / 03  

---

## 1. Inputs

| Input | Source |
|-------|--------|
| Device config | Local defaults (`TV` / `PASSIVE` / `landscape`) + `deviceId` from `v360-player-config` LS when present |
| Domain policy | `defaultPolicyFromDeviceConfig()` / optional explicit override |
| Capabilities | `probeRuntimeCapabilities()` |
| Environment | probe meta (`fragileSmartTv`, `secureContext`, …) |

No `DeviceRuntimeConfig` table.

---

## 2. Precedence

1. Explicit domain policy  
2. Detected capability  
3. Environment constraint  
4. Safe fallback  

Domain: `resolveRuntimePolicy()` — single algorithm (not reimplemented in Player).

---

## 3. Defaults

Via `DEFAULT_DOMAIN_RUNTIME_POLICY` + device-derived presentation/orientation/interaction.  
Cursor remains **AUTO_HIDE**. Interaction MVP **PASSIVE**.

---

## 4. Resolution

`resolvePlayerRuntimePolicy()` in `src/player/runtime/resolve-policy.ts` wires probe + domain resolver → `RuntimePolicyBundle`.

---

## 5. Fallbacks

Observable `fallbacks[]` + `diagnostics[]` (e.g. FULLSCREEN→WINDOWED, REMOTE→KEYBOARD_LIKE, orientation→AUTO, `INTERACTIVE_NOT_IMPLEMENTED`).

---

## 6. Diagnostics

`window.__v360_runtime_policy` + player diag overlay (`D`): requested→resolved, fallbacks, capabilities. No secrets. Flags: `fullscreenApiCalled: false`, `orientationLockCalled: false`.

---

## 7. React integration

`PlayerRuntimeShell`:

1. Probe capabilities  
2. Resolve policy  
3. Publish globals  
4. `CursorIdleController(resolved.cursor)` — no duplicate cursor logic  

No playback / sync / cache changes. **No** `requestFullscreen` / `orientation.lock`.

---

## 8. Legacy strategy

Domain remains the only resolver. Legacy does **not** reimplement the algorithm this phase; capability probe mirror exists from POLICY-03. Full resolution wiring on `tv.js` deferred (adapter later if needed).

---

## 9. Security

`assertNoAuthTokenExposure` + `assertTenantDeviceScope` on resolve path. Global snapshot strips tokens.

---

## 10. Tests

`npm run test:runtime-policy-04` — POLICY-RESOLVE-001…016.

## 11. Browser E2E

`npm run test:runtime-policy-live` — Chromium /player + simulated fragile env.  
Evidence: `docs/evidence/runtime-policy-04/RESOLUTION-E2E-RESULTS.md`

## 12. Known limitations

- Local Device config lacks server `displayType`/`tenantId` until a future sync enrichment (defaults used).  
- Legacy not fully wired to resolver.  
- Presentation FULLSCREEN is resolved only — API not invoked.
