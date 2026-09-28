# PLAYBACK-CONTRACT-01
# MEDIA ERROR SEMANTICS

## Historical Behavior
Prior to commit `906ba73`, any `MEDIA_PLAY_ERROR` emitted by the playback pipeline (such as those resulting from an Autoplay NotAllowedError) would immediately force the `PlaybackController` into the `ERROR` state. This manifested visually as a completely broken UI (the red/black error overlay), halting the player in an aggressive manner, even though the media was physically intact but just waiting for user interaction.

## Current Behavior
In commit `906ba73`, the `PlaybackController` was updated so that when `code === "MEDIA_PLAY_ERROR"`, it gracefully transitions to `PAUSED` instead of `ERROR`. This keeps the player visually operational and allows a simple "PLAY" command to resume the exact same media element, preserving any unmuted user gestures.

## MEDIA-054
Test `MEDIA-054 retry via controller` was not updated to reflect this architectural change. It continued to inject `MEDIA_PLAY_ERROR` into the system and assert `assert.equal(c.getState().status, "ERROR");`. The test essentially mandates the historical, inferior behavior, thus creating a formal discrepancy between test expectations and production code.

## PlaybackError Mapping
- `MEDIA_LOAD_ERROR`: Non-recoverable without reload -> `ERROR`
- `MEDIA_DECODE_ERROR`: Non-recoverable without reload -> `ERROR`
- `MEDIA_UNSUPPORTED`: Non-recoverable without reload -> `ERROR`
- `MEDIA_TIMEOUT`: Non-recoverable without reload -> `ERROR`
- `MEDIA_PLAY_ERROR`: Recoverable via direct interaction -> `PAUSED`

## State Machine
- **MEDIA_PLAY_ERROR**: Transitions from `PLAYING`/`LOADING` to `PAUSED`. It is recoverable. A `PLAY` action from `PAUSED` will directly resume the element (`el.play()`).
- **MEDIA_ERROR (other)**: Transitions to `ERROR`. It is only recoverable via hard reload (a `PLAY` action from `ERROR` triggers `LOADING` and re-mounts the item).

## Retry
A retry from `PAUSED` (`el.play()`) is fundamentally different from a retry from `ERROR` (unmount, remount, reload). The current architecture efficiently uses the `PAUSED` retry path for Autoplay rejections.

## Autoplay
`ensureMediaPlayback()` attempts an audible play. If that rejects, it attempts a muted play. If that also rejects (or if it throws), it emits `MEDIA_PLAY_ERROR`. This properly maps to `PAUSED`, because the browser has physically paused the video element.

## UI Semantics
`ERROR` indicates a terminal failure requiring an overlay. `PAUSED` indicates the player is halted but fundamentally healthy and awaiting interaction. A blocked autoplay is healthy but halted.

## Test Conflicts
`MEDIA-054` is the only test conflicting with this logic.

## Decision
**OPTION B**
We will formally map `MEDIA_PLAY_ERROR` to `PAUSED` and update the test contract. The architectural base for this is already solid and superior to the historical behavior.

## Findings
CRITICAL: `MEDIA-054` enforces an obsolete and inferior state transition (`ERROR` instead of `PAUSED`).
HIGH: 
MEDIUM: 
LOW: 
INFO: The `PAUSED` fallback introduced in `906ba73` was architecturally sound and should be retained.

## VERDICT
[PLAYBACK-CONTRACT-01 AUDIT COMPLETE]
