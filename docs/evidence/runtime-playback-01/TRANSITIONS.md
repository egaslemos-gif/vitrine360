# TRANSITIONS — RUNTIME-PLAYBACK-01

Source: `PLAYBACK_TRANSITIONS` in `src/domain/playback-state.ts`

| From | Allowed to |
|------|------------|
| IDLE | LOADING, ERROR |
| LOADING | PLAYING, PAUSED, STOPPED, ERROR, IDLE |
| PLAYING | PAUSED, STOPPED, ENDED, ERROR, LOADING |
| PAUSED | PLAYING, STOPPED, LOADING, ERROR |
| STOPPED | PLAYING, LOADING, IDLE |
| ENDED | PLAYING, LOADING, STOPPED, IDLE |
| ERROR | LOADING, IDLE, STOPPED |

Same-status is always allowed (`canTransition`).

## Semantics

| Status | Meaning |
|--------|---------|
| IDLE | No playlist / empty |
| LOADING | Item selected; media/slide not ready |
| PLAYING | Active playback or slide elapsed progressing |
| PAUSED | Position preserved |
| STOPPED | Position 0; identity preserved |
| ENDED | Playlist finished (repeat NONE) |
| ERROR | Structured PlaybackError set |

## STOP

Preserves `playlistId`, `currentItemIndex`, `currentContentId`, `manifestVersion`. Sets `positionMs = 0`.
