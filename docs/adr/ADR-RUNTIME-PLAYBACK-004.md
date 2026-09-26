# ADR-RUNTIME-PLAYBACK-004 — Local Playback Controls via Canonical Actions

## Status

Accepted — 2026-09-26

## Context

RP-01…03 established PlaybackController as the sole playback source of truth. UI, keyboard, and touch still needed a professional control surface without calling media elements or mutating playlist index directly.

## Decision

1. All local playback controls dispatch canonical `PlaybackAction` values through `PlaybackController`.
2. UI components (`PlaybackControls`, `PlaybackChrome`, keyboard hook) never directly control HTML media elements or playlist state.
3. Control availability is derived from `PlaybackState` (+ media type), not from a parallel `isPlaying` / local volume store.
4. Fullscreen reuses RUNTIME-POLICY-08A `FullscreenController`.
5. Auto-hide reuses RUNTIME-POLICY-02 `CursorIdleController` (or Runtime State `cursorVisible` when the shell already owns it).
6. Remote device command APIs are out of scope (future Remote → same `PlaybackAction` path).

## Consequences

- Player and future Device Control Console share one action vocabulary.
- Seek drag may preview locally; commit is a single `SEEK` on pointer up.
- Shuffle is not implemented; not exposed as functional UI.
