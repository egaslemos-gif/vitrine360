# Vitrine360 — RUNTIME-POLICY-08A Fullscreen Capability & Control

**Date:** 2026-09-23  
**Status:** IMPLEMENTATION VALIDATED (software / Chromium)  
**Depends on:** POLICY-01 … 07  

**Not claimed:** PHYSICAL DEVICE VALIDATED · PRODUCTION VALIDATED · Hisense PASS

---

## 1. Fullscreen architecture

```
Requested Policy
      ↓
Resolved Policy (presentation)
      ↓
Fullscreen Capability (API detected)
      ↓
Fullscreen Eligibility (policy + API + not in-flight)
      ↓
Fullscreen Request (requires userActivation)
      ↓
Actual state ← document.fullscreenElement
```

Single controller: `src/player/runtime/fullscreen.ts` (`FullscreenController`).  
Target element: `.player-runtime-root` (`PlayerRuntimeShell`).

## 2. Capability vs permission

`DetectedRuntimeCapabilities.fullscreen === true` means the Fullscreen API surface was detected (POLICY-03).  
It does **not** guarantee `requestFullscreen()` will succeed. The controller still gates on eligibility + activation + browser permission.

## 3. User activation

- **Boot:** never calls `requestFullscreen()`; emits `FULLSCREEN_USER_ACTIVATION_REQUIRED` when resolved wants FULLSCREEN.
- **Explicit:** button “Entrar em ecrã inteiro” or keyboard **F** (not F11) within the gesture handler with `userActivation: true`.
- **No** `setTimeout` bypass, **no** polling retry loop.

## 4. Controller

Authorized operations only in `FullscreenController`:

- `request()` / `exit()`
- observe `fullscreenchange` / `fullscreenerror`
- request dedupe (`requestInFlight`, already active)
- publish `RuntimeState` (`fullscreenActive`, `fullscreenStatus`, `fullscreenDiagnosticCode`)

## 5. State machine

`IDLE → REQUESTING → ACTIVE | FAILED`  
`IDLE → UNAVAILABLE`  
`ACTIVE → IDLE` (exit / Escape / fullscreenchange)

No concurrent `REQUESTING → REQUESTING`.

## 6. Request deduplication

Skips when `fullscreenElement` set, request in flight, policy `WINDOWED`, or API unavailable.

## 7. Error handling

Classifies via `error.name` (prefer) + safe message slice:

| Code | Typical trigger |
|------|-----------------|
| `FULLSCREEN_UNAVAILABLE` | API missing / disabled |
| `FULLSCREEN_USER_ACTIVATION_REQUIRED` | NotAllowedError / no activation |
| `FULLSCREEN_REQUEST_FAILED` | other rejection / fullscreenerror |
| `FULLSCREEN_ACTIVE` / `FULLSCREEN_EXITED` | relevant transitions only |

No stack traces in admin/heartbeat payloads.

## 8. Actual state

`fullscreenActive` always derived from `document.fullscreenElement` (via injected API surface in tests).  
Promise resolution alone does not set ACTIVE.

## 9. Diagnostics

Includes above codes plus updated `PRESENTATION_NOT_ACTUALLY_FULLSCREEN` with a known reason (e.g. user activation required, not yet requested, API unavailable, rejected).

## 10. Browser compatibility

Standard Fullscreen API only (`fullscreenEnabled`, `requestFullscreen`, `exitFullscreen`, `fullscreenElement`, events).  
No vendor prefixes invented. Hisense/Sraf support **unknown** until physical test.

## 11. Security

Controller / state / heartbeat use `assertNoAuthTokenExposure`. No auth tokens in DOM globals. Device auth unchanged. Failures do **not** mutate Device DB / presentation config.

## 12. E2E

`npm run test:fullscreen-live` — Chromium scenarios A–F.  
Evidence: `docs/evidence/runtime-policy-08a/FULLSCREEN-E2E-RESULTS.md`

## 13. Regression

`npm run test:runtime-policy-08a` (FULLSCREEN-001…020) plus POLICY-01…07 and project `npm test` / typecheck / build / lint.

## 14. Limitations

- Orientation lock **not** implemented (08B+).
- Headless Chromium may deny fullscreen after a valid request — request is still counted; actual may stay WINDOWED.
- Scenario E uses `installUnavailable()` (null API controller) because Chromium resists Document.prototype Fullscreen stubs under Next; same code path as real API absence.
- Hisense physical behaviour not observed in this phase.
- F11 is browser chrome, not used.

## 15. Physical device status

**NOT VALIDATED** on Hisense / VIDAA. Soft degrade expected if API absent.

## Keyboard

| Key | Action |
|-----|--------|
| `F` | Toggle fullscreen when resolved presentation is FULLSCREEN |
| `Escape` | Browser native exit — never intercepted by Vitrine360 |
| `F11` | Not used |

## UI

Discrete control on PlayerRuntimeShell when API available + resolved FULLSCREEN.  
`data-testid`: `v360-fullscreen-enter` / `v360-fullscreen-exit`.
