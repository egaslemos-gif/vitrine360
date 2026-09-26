# RUNTIME-EXPERIENCE-11 — Player Integration & Controlled Experience Execution

**Status:** IMPLEMENTATION VALIDATED (software / Chromium contracts)  
**Date:** 2026-09-23  
**Depends on:** EXPERIENCE-01 … 10, ARCHITECTURE-FUTURE-01  
**Planes:** Experience · Distribution · Device Runtime

## 1. Objective

Wire **real** Experience execution into the React Player:

```text
Manifest item (EXPERIENCE)
  → DisplayEngine
  → ExperiencePlaybackSlide
  → POST /api/device/experience/admit
  → admitExperienceForDevice
  → ExperienceRuntimeShell
  → Sandbox + Controlled Bridge (RUNTIME_READ)
  → READY → ACTIVE
  → unmount / stop → Cleanup → next slide
```

## 2. Integration principle

| Layer | Knows |
|-------|--------|
| DisplayEngine | `type === EXPERIENCE` → `ExperiencePlaybackSlide` only |
| ExperiencePlaybackSlide | Admit API + Shell |
| ExperiencePlaybackController | Runtime Core lifecycle adapter |
| Admit API | Device bearer, package store, admission domain |

DisplayEngine must **not** import registry/validator/bridge/storage providers.

## 3. Files

| Path | Role |
|------|------|
| `src/player/runtime/experience-controller.ts` | Playback controller adapter |
| `src/player/playback/experience-slide.tsx` | React slide host |
| `src/player/playback/display-engine.tsx` | EXPERIENCE branch → slide |
| `src/app/api/device/experience/admit/route.ts` | Device admission endpoint |
| `docs/evidence/runtime-experience-11/*` | Audit + checklist |

## 4. Security invariants

1. Admission mandatory — PUBLISHED ≠ ADMITTED.  
2. No JWT / device bearer inside iframe or Shell props.  
3. Bridge remains RUNTIME_READ only.  
4. Network / camera / microphone / storage elevated permissions forced false on conceptual assignment.  
5. Cross-tenant package miss → DENY.  
6. Legacy `tv.js` stays **EXPERIENCE_UNSUPPORTED** (non-exec).  
7. Fail closed → `data-experience-playback="safe-fallback"`.

## 5. Known limitations

| Limitation | Notes |
|------------|--------|
| In-memory package store | Multi-instance / restart may DENY until package re-stored |
| Conceptual device assignment | No ExperienceAssignment table — playlist pin + published package |
| durationMs still advances | Existing playlist timer; interactive max-session not in EX-11 |
| EXPERIENCE_ORIGIN required | Misconfig → runtime ERROR / fallback |
| Hisense | PHYSICAL VALIDATION — NOT AVAILABLE; React only |

## 6. Non-goals (unchanged)

Live Media, WebRTC, Camera/Mic, Campaigns, Billing, Analytics pipeline, Experience persistent storage, Network FULL, Fullscreen/Orientation bridge CONTROL.

## 7. Tests

`npm run test:runtime-experience-11`  
Regression: `test:runtime-experience-09` (CONTENT-EXP-018 updated for EX-11 surface).

## 8. Verdict target

**RUNTIME-EXPERIENCE-11 — PLAYER INTEGRATION VALIDATED** when tests + typecheck pass and legacy remains non-exec.
