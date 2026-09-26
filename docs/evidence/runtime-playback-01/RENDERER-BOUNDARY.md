# RENDERER-BOUNDARY — RUNTIME-PLAYBACK-01

## Rule

Renderer **must not** decide playlist NEXT/PREVIOUS/ENDED policy.

## Event contract (renderer → controller)

| Event | Action |
|-------|--------|
| loading started | `MEDIA_LOADING` |
| metadata / ready | `MEDIA_READY` + duration + generation |
| timeupdate | `MEDIA_TIME_UPDATE` + generation |
| ended | `MEDIA_ENDED` + generation |
| error | `MEDIA_ERROR` + generation |

## Controller decides

- Whether ENDED vs NEXT (repeatMode)
- ITEM repeat restart
- Stale rejection via generation

## Current production renderer

DisplayEngine still contains playlist timers (legacy behaviour preserved). RP-02 will adapt it to emit the events above.

## Experience

`currentContentType = EXPERIENCE` may appear on PlaybackState. Execution remains solely via Experience Runtime (admission/sandbox/bridge) — unchanged in RP-01.
