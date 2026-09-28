# RETRY CONTRACT

## Current Test Semantics (`MEDIA-054`)
The test assumes:
`ERROR` -> `c.dispatch({ type: "PLAY" })` -> `LOADING` or `PLAYING`

## Actual Semantics
When an autoplay block happens, the controller enters `PAUSED`.
`PAUSED` -> `c.dispatch({ type: "PLAY" })` -> `PLAYING`

## Analysis
The retry contract for an actual broken media asset (e.g. `MEDIA_LOAD_ERROR`) remains `ERROR` -> `PLAY` -> `LOADING`. This forces a hard reload, which is correct for broken pipelines.
However, for an autoplay block (`MEDIA_PLAY_ERROR`), the state is `PAUSED`. The retry contract is simply `PAUSED` -> `PLAY` -> `PLAYING`, which efficiently un-pauses the video element.
Both contracts are semantically coherent for their respective use cases. The issue is simply that `MEDIA-054` uses `MEDIA_PLAY_ERROR` to test the general retry mechanism, and expects `ERROR`, which is no longer applicable to `MEDIA_PLAY_ERROR`.
