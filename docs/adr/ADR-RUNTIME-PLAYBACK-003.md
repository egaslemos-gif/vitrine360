# ADR-RUNTIME-PLAYBACK-003 — Playlist Navigation & Timing Ownership

## Status

Accepted — 2026-09-26

## Context

After RP-02, navigation lived in PlaybackController, but timing was an ad-hoc `setTimeout` loop in the adapter, and `MEDIA_ENDED` after STOP could still advance because only generation was checked.

## Decision

1. Playlist navigation remains exclusively in PlaybackController.
2. Presentation timing is owned by `PresentationTimer` (generation-scoped, wall-clock elapsed).
3. Natural VIDEO/AUDIO completion is owned by native media `ended` only — no competing timer.
4. `MEDIA_ENDED` is accepted only when `status === PLAYING` and generation matches.
5. Soft remap rules for SYNC_PLAYLIST are formalized (item id → content id → clamp → IDLE).

## Consequences

- Deterministic pause/resume for slides (position preserved).
- STOP/NEXT races cannot advance from stale ended events.
- Empty playlist can transition to IDLE from PLAYING.
