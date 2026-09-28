# DECISION

## Selected Option: OPTION B
`MEDIA_PLAY_ERROR -> PAUSED` and update the test/contract for `PAUSED`.

## Rationale
1. **Physical Accuracy**: When the browser throws `NotAllowedError` for autoplay, it halts the playback pipeline but does NOT break it. The video element `paused` property is strictly `true`. Mapping this to `PAUSED` perfectly mirrors the actual physical state of the DOM element.
2. **UX Preservation**: The player should remain visually operational when play is rejected due to lack of user interaction. An error overlay is a UX degradation. A paused state leaves the content visible, encouraging the user to interact.
3. **Retry Efficiency**: Calling `play()` from `PAUSED` skips the teardown and initialization phases, merely calling `el.play()`. This is exactly what is needed to recover from an autoplay block once the user interacts. Calling `play()` from `ERROR` would trigger a full reload, which is destructive and could result in losing the user gesture context entirely.
4. **Conclusion**: The architectural decision introduced in `906ba73` was functionally correct and superior. The fault lies exclusively in the rigid test contract of `MEDIA-054` which did not evolve with the architecture.
