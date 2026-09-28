# ADR 001: Media Play Error Semantics and Autoplay Recovery

## Status
Accepted

## Context
When browsers strictly enforce autoplay policies, `HTMLMediaElement.play()` returns a Promise that rejects with a `NotAllowedError`. Previously, our system treated this as a terminal `MEDIA_ERROR`, forcing the `PlaybackController` into an `ERROR` state. This manifested as a broken, red/black error overlay, which is an aggressive UX degradation for a media element that is otherwise perfectly healthy and simply awaits user interaction. 
In commit `906ba73`, the controller was patched to map `MEDIA_PLAY_ERROR` to `PAUSED`. This kept the player operational, allowing recovery via a simple "play" action. However, the testing suite (`MEDIA-054`) was not updated and continued to assert `ERROR`.

## Decision
We formally adopt `PAUSED` as the correct semantic state for `MEDIA_PLAY_ERROR`. 

1. **Physical Accuracy**: An autoplay rejection leaves the video physically `paused`. It does not break the media pipeline.
2. **UX Preservation**: The player stays visually intact, awaiting the user's action.
3. **Retry Efficiency**: Resuming from `PAUSED` merely invokes `play()` on the existing element, which is the exact requirement to satisfy the browser's user-gesture mandate. Resuming from `ERROR` would trigger a full unmount and reload, unnecessarily destroying the current DOM context.

## Consequences
- Test `MEDIA-054` must be updated to expect `PAUSED` instead of `ERROR`.
- `MEDIA_PLAY_ERROR` is now officially distinct from `MEDIA_LOAD_ERROR` or `MEDIA_DECODE_ERROR` (which correctly remain mapped to `ERROR`).
