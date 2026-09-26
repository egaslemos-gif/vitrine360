# ADR-EXPERIENCE-011 — Player Integration & Controlled Experience Execution

## Status

Accepted — RUNTIME-EXPERIENCE-11

## Context

EX-08 admission, EX-06/07 sandbox/bridge, and EX-10 Runtime Core + Shell exist, but the React DisplayEngine only showed a safe-fallback (`PENDING_RUNTIME`). Architecture-Future-01 and agent guardrails forbade wiring without an explicit EX-11 gate.

Package store is server-side (in-memory). Browser Player cannot admit without a device-authenticated API.

## Decision

1. Introduce `ExperiencePlaybackController` as a thin Device Runtime adapter over `ExperienceRuntimeController` (no duplicate lifecycle).  
2. Introduce `ExperiencePlaybackSlide` that calls `POST /api/device/experience/admit` then mounts `ExperienceRuntimeShell`.  
3. DisplayEngine delegates EXPERIENCE to the slide only — no registry/validator/bridge imports.  
4. Admit API uses device Bearer, package store lookup, and `admitExperienceForDevice` with a **conceptual** assignment (playlist-eligible published package).  
5. Keep legacy `tv.js` non-executing.  
6. Do not implement Live Media, Billing, Camera/Mic, Network FULL, or Experience DB persistence in this phase.

## Consequences

### Positive

- Real admit → execute path on React Player  
- Clear security boundary (tokens never enter Shell)  
- Reuses EX-08…10 without forking  

### Risks / costs

- In-memory store limits production multi-instance until persistence phase  
- Conceptual assignment is not a durable admin grant table  
- Playlist `durationMs` still ends the slide  

## References

- `docs/RUNTIME-EXPERIENCE-11-PLAYER-INTEGRATION.md`  
- `docs/evidence/runtime-experience-11/PRE-IMPLEMENTATION-AUDIT.md`  
- ADR-EXPERIENCE-008 … 010
