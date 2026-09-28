# TEST CONTRACT

## MEDIA-054
**Given**: A controller is loaded with a VIDEO item and wait for initialization (READY).
**When**: `MEDIA_ERROR` with code `MEDIA_PLAY_ERROR` is dispatched.
**Then**: The state status should be strictly `ERROR`.
**Current Actual**: `PAUSED`

## Other Affected Tests
No other tests currently fail. `MEDIA-051 error overlay safe copy` tests an unknown error, which falls back to `ERROR` and tests the overlay. It passes because it does not use `MEDIA_PLAY_ERROR`.

## Conflict
`MEDIA-054` is the only test that specifically asserts the status after a `MEDIA_PLAY_ERROR`. Since the production architecture was changed to treat this specific error as `PAUSED` (to handle Autoplay Blocking gracefully), this test's assertion is formally out of sync with the architectural intent.
