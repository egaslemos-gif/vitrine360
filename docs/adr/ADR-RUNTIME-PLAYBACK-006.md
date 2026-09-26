# ADR-RUNTIME-PLAYBACK-006 — Session Observation & Telemetry

## Status

Accepted — 2026-09-26

## Context

RP-01…05 established PlaybackController as SoT and professional media controls. Admin/runtime already had Presence + RuntimeState + coarse heartbeat PLAYING/IDLE, but lacked session identity, rich playback observation, and a safe local telemetry model.

## Decision

1. Introduce **PlayerSession** and **PlaybackObservation** as client projections — not new authorities.
2. Emit essential transition telemetry into a **bounded in-memory queue** with sanitization and dedupe.
3. Extend heartbeat with compact `playback` + `sessionId` fields treated as **OBSERVED** only.
4. Keep PlaybackState, RuntimeState, Presence, and SyncState as separate dimensions.
5. Telemetry failure must never block playback actions.
6. No remote command APIs; no DB migration; no per-frame telemetry.

## Consequences

- Admin can display observed playback status without conflating ONLINE with PLAYING.
- Diagnostics globals aid lab/dev inspection.
- Future warehouses can drain the queue without changing PlaybackController.
