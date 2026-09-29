# PLAY ERROR ANALYSIS

## 1. Hisense Playback Rejection
When `URL.createObjectURL(blob)` is assigned to `video.src` on the Sraf browser, the browser attempts to fetch the initial bytes to decode metadata.
Because `blob:` URLs do not support byte-range requests, the native media backend immediately signals a failure.
This triggers the `onError` event handler on the `<video>` element, mapping to `MEDIA_DECODE_ERROR`.

## 2. Promise Rejection Handling
In `ensureMediaPlayback`, `el.play()` returns a Promise. If playback cannot begin (e.g. autoplay blocked), it is caught and it falls back to `startMuted()`.
If the muted playback also rejects, the `onUnrecoverable` callback is fired, emitting `MEDIA_PLAY_ERROR`.
However, because Hisense fails at the source/decode level *before* or *during* the play initialization, it typically triggers the `onError` handler directly, which emits a `recoverable: true` error.

## 3. Playback Controller Policy
The `PlaybackController` handles `MEDIA_ERROR` with `recoverable: true` by executing its error policy.
The default policy for recoverable media errors is to log a warning and advance to the next slide to ensure the digital signage presentation does not freeze.
This perfectly explains the symptoms: VIDEO fails, is skipped, and the playlist continues.
