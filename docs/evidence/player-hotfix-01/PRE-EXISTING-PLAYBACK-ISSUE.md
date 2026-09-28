# PRE-EXISTING PLAYBACK CONTRACT ISSUE

## Baseline
Commit `214daa9` (HEAD^)

## Test Result
`FAIL MEDIA-054 retry via controller: Expected values to be strictly equal:`
`'PAUSED' !== 'ERROR'`

## First Known Failure
Commit `906ba73c1d0e979860ec17cd40cd7544aecd8dbc`
("fix: gracefully fallback to paused state instead of showing error overlay on autoplay block")

## Current Behavior
When `MEDIA_PLAY_ERROR` is dispatched, the `PlaybackController` transitions the state to `PAUSED` instead of `ERROR`.

## Expected Contract (by Test)
The test `MEDIA-054` simulates an autoplay block/failure and expects the `PlaybackController` to transition into a formal `ERROR` state so that retry semantics can be validated.

## Impact
The test suite fails, blocking CI. 
The actual user experience is functional (the player pauses gracefully instead of crashing), but the state machine contract is formally broken with respect to its test suite. 

## Remediation Required
A separate remediation effort is required (`PLAYBACK-CONTRACT-REMEDIATION`) to either:
1. Update `MEDIA-054` to expect `PAUSED` instead of `ERROR`.
2. Introduce a distinct `AUTOPLAY_BLOCKED` state or event, separating it from general `MEDIA_PLAY_ERROR` so the controller can gracefully degrade to `PAUSED` while allowing other errors to properly transition to `ERROR`.
