# ADR-RUNTIME-PLAYBACK-001 — Playback State as First-Class Runtime Domain

## Status

Accepted — 2026-09-26

## Context

Vitrine360 playback logic was embedded in DisplayEngine (React) and duplicated in `public/tv.js`. There was no shared typed contract for status, playlist position, volume, or media errors. Future remote control, diagnostics, and Playback Sessions need a stable state model that is not coupled to rendering, presence, sync, or device auth.

## Decision

Playback becomes a first-class runtime domain:

1. **PlaybackState** / **PlaybackStatus** / **PlaybackAction** / **RepeatMode** / **PlaybackError** live in `src/domain/playback-state.ts`.
2. **PlaybackController** (`src/player/playback/playback-controller.ts`) is the source of truth for playback snapshots.
3. Rendering, Presence, Sync/RuntimeState, Experience Runtime, and Remote Commands remain separate bounded contexts.
4. Stale media events are rejected via monotonic `generation`.
5. No database tables, migrations, remote command APIs, or heartbeat contract changes in this phase.
6. Legacy `tv.js` and Landing Demo stay outside this controller until explicit adapters.

## Consequences

### Positive

- Deterministic transitions and navigation rules testable without DOM.
- Clear renderer boundary for RP-02 integration.
- Safe foundation for remote control without leaking auth into playback.

### Negative / follow-ups

- DisplayEngine not yet driven by PlaybackController (RUNTIME-PLAYBACK-02).
- Legacy tv.js does not emit PlaybackState yet (future adapter).

## Alternatives considered

- Extend RuntimeState with media fields — rejected (mixes sync/presence with media).
- Keep logic only in DisplayEngine — rejected (blocks remote control and dual-runtime parity).
