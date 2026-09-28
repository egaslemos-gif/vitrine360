# MEDIA ERROR SEMANTICS

## What does ERROR mean in PlaybackState?
`ERROR` indicates that the playback pipeline for the current item has terminally failed and the media cannot be presented without being re-loaded or skipped. It implies a physical or logical breakdown in the media asset itself or the network.

## What does PAUSED mean?
`PAUSED` indicates that the media is loaded, valid, and physically capable of playback, but its progression has been halted. This could be due to explicit user interaction, or because the browser's autonomous policies (autoplay blocking) prevented the start of playback.

## Answers to Semantic Questions:
1. **ERROR significa que o media pipeline falhou e necessita de intervenção/retry?** Yes, an `ERROR` state means the current pipeline is broken (e.g. 404, format not supported, decode failed) and requires either skipping the item or a full reload/retry.
2. **PAUSED significa que o playback foi deliberadamente pausado?** Usually yes, but it also physically represents the state of a video element when `play()` is denied by the browser. The video *is* paused.
3. **Um erro de autoplay deve ser representado como ERROR?** No. The media itself is fine. The environment simply requires user interaction to proceed. Transitioning to `ERROR` forces a full reload which is unnecessary and might clear the user gesture context.
4. **Um erro recuperável de play deve ser representado como PAUSED?** Yes. If `play()` throws `NotAllowedError`, the video is paused. We should represent this as `PAUSED`.
5. **O Player deve continuar visualmente operacional quando play() é rejeitado?** Yes. An error overlay obscures the player. A paused video is still visually operational and provides context to the user that they just need to click "Play".
6. **Retry deve funcionar a partir de ERROR?** Yes. `play()` from `ERROR` triggers `this.beginCurrentItem({ resetPosition: true })`, completely reloading the item.
7. **Retry deve funcionar a partir de PAUSED?** Yes. `play()` from `PAUSED` triggers `this.transition("PLAYING")`, which simply attempts to un-pause the existing DOM element without reloading. This is ideal for Autoplay rejections.
