# ADR-RUNTIME-PLAYBACK-002 — Controller as React Player SoT

## Status

Accepted — 2026-09-26

## Context

RP-01 introduced a typed PlaybackController, but DisplayEngine still owned playlist index and timers independently — two state machines.

## Decision

For the React Player path:

1. **PlaybackController** is the single playback source of truth.
2. **DisplayEngine** is an orchestration shell (load/sync/subscribe/render).
3. **PlaybackRendererAdapter** is a presentation/media adapter that emits `MEDIA_*` events with `generation`.
4. Legacy `tv.js` and Landing Demo remain separate.

## Consequences

- Playlist progression is centralized and testable.
- Stale media events cannot advance the wrong item.
- Future remote control can call `controller.dispatch` without rewriting renderers.
- DisplayEngine no longer uses local `setIndex` / advance timers.
