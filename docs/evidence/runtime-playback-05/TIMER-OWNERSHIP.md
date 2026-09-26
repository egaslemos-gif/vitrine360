# RUNTIME-PLAYBACK-05 — TIMER OWNERSHIP

| Owner | Responsibility |
|-------|----------------|
| PlaybackRendererAdapter | Single `PresentationTimer` instance for still / explicit AV / experience-hosted |
| HTMLVideoElement / HTMLAudioElement | Native `ended` when `durationMs===0` |
| PlaybackController | Interprets MEDIA_ENDED / tickImageElapsed; playlist policy |
| DisplayEngine | **No** presentation timers |

## Race protection

- Explicit AV: `loop={true}`; `onEnded` only if `nativeEnded`.
- Stale ticks: generation check inside timer `onTick` and controller handlers.
