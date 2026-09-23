# Vitrine360 — RUNTIME-POLICY-08B Orientation Capability & Control

**Date:** 2026-09-23  
**Status:** IMPLEMENTATION VALIDATED (software / Chromium)  
**Depends on:** POLICY-01 … 08A  

**Not claimed:** PHYSICAL DEVICE VALIDATED · PRODUCTION VALIDATED · Hisense PASS

---

## 1. Architecture

```
Requested Orientation
        ↓
Resolved Orientation
        ↓
Observation capability / Lock capability
        ↓
Eligibility (AUTO? lock API? in-flight? requiresFullscreen?)
        ↓
lock() when allowed (never requestFullscreen)
        ↓
Actual ← observation (viewport-first in Player / type-first optional)
```

Single controller: `src/player/runtime/orientation.ts` (`OrientationController`).

## 2. Observation vs control

| Concern | Mechanism |
|---------|-----------|
| Observation | `screen.orientation.type`, `resize`, viewport aspect |
| Control | `screen.orientation.lock()` / `unlock()` |

`orientationActual` ≠ `orientationStatus` (lock state machine).

## 3. Capability

- Reuses `DetectedRuntimeCapabilities.orientation` as a hint.
- Separately: **observationAvailable** vs **lockAvailable** (`typeof lock === "function"`).
- `orientation=true` from POLICY-03 is not redefined.

## 4. Eligibility (`canLockOrientation`)

- Resolved ≠ AUTO  
- Lock API present  
- Not in-flight / not already locked to same target  
- If prior browser rejection indicated fullscreen: `ORIENTATION_REQUIRES_FULLSCREEN` when not fullscreen  

No universal “fullscreen always required” rule invented up-front — browser rejection classifies it.

## 5. Fullscreen relationship

```
FullscreenController → fullscreenActive change
        ↓
OrientationController.onFullscreenActiveChange
        ↓
try lock if eligible
```

Orientation **never** calls `requestFullscreen()`. Hint UI: *“É necessário entrar em ecrã inteiro para bloquear a orientação.”*

## 6. State machine

`IDLE → REQUESTING → LOCKED | FAILED`  
`→ UNAVAILABLE`  
`LOCKED → IDLE` (unlock / AUTO)

## 7–8. Lock / unlock

- LANDSCAPE → `"landscape"`; PORTRAIT → `"portrait"`; AUTO → no lock  
- Unlock only when actually locked; AUTO after lock → controlled unlock  

## 9. Actual orientation

Player default: **viewport-first** (POLICY-06 paint fidelity), then `screen.orientation.type`.  
Tests may set `preferViewportForActual: false` for type-first.  
Promise resolve ≠ fake actual.

## 10. Diagnostics

`ORIENTATION_LOCK_ACTIVE` · `ORIENTATION_LOCK_EXITED` · `ORIENTATION_LOCK_UNAVAILABLE` · `ORIENTATION_LOCK_NOT_ALLOWED` · `ORIENTATION_REQUIRES_FULLSCREEN` · `ORIENTATION_LOCK_FAILED` · `ORIENTATION_MISMATCH` (not for AUTO)

## 11. Runtime State

`orientationStatus`, `orientationDiagnosticCode` on `__v360_runtime_state` / heartbeat (optional, backward-compatible).

## 12. Admin observability

Requested / Resolved / Capability (OBSERVATION|LOCK) / Control / Actual / Lock status + diagnostics.

## 13. Browser compatibility

Standard Screen Orientation API only. Headless Chromium often denies lock without fullscreen. Hisense unknown.

## 14. Security

`assertNoAuthTokenExposure`; no Device.orientation mutation on failure; no tokens in DOM.

## 15. E2E

`npm run test:orientation-live` — scenarios A–H.  
Evidence: `docs/evidence/runtime-policy-08b/ORIENTATION-E2E-RESULTS.md`

## 16. Regression

`npm run test:runtime-policy-08b` (ORIENTATION-001…022) + POLICY-01…08a + `npm test` / typecheck / build / lint.

## 17. Limitations

- No Interactive Runtime / orientation vendor prefixes  
- Headless lock often denied  
- Legacy `tv.js` has no second controller  

## 18. Physical validation

**NOT VALIDATED** on Hisense / VIDAA.
