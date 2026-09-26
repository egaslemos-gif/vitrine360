# RUNTIME-PLAYBACK-05 — AUDIO UX

- Static CSS waveform (`data-audio-waveform="static"`) — not Web Audio.
- Artwork placeholder glyph.
- Title + optional `payload.artist` / `payload.album`.
- Progress bar from `PlaybackState.positionMs` / `durationMs`.
- Hidden `<audio>` element for actual playback.
- Accessible `aria-label` = title.
- No external network assets for the visual.
