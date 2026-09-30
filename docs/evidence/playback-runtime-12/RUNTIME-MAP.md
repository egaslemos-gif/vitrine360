# RUNTIME MAP

## /player (React Player)
- **Entrypoint**: `src/features/player/player-app.tsx` -> `PlaybackChrome` -> `DisplayEngine`
- **Componentes**: `PlaybackChrome`, `DisplayEngine`, `PlaybackRendererAdapter`, `AudioVisual`, `DiagnosticOverlay`
- **Controller**: `PlaybackController` (`src/player/playback/playback-controller.ts`)
- **Media Element**: `HTMLVideoElement` (usado tanto para AUDIO quanto para VIDEO no React Player), `<img>` para IMAGE, `canvas` para CLOCK/EXPERIENCE.
- **Manifest Source**: `src/player/sync/engine.ts` -> IndexedDB -> `DisplayEngine` (`SYNC_PLAYLIST`)
- **Controls**: `PlaybackControls` (UI), `usePlaybackKeyboard`
- **Session**: `DevicePolicyConfigWire` -> `LocalConfig`
- **Cleanup**: `useEffect` destructors em `PlaybackRendererAdapter`, `URL.revokeObjectURL`
- **Browser Lifecycle**: Visibility events, cursor idle timeout
- **Device Lifecycle**: Heartbeat (`src/player/sync/engine.ts`)

## /tv.html (Legacy Player)
- **Entrypoint**: `public/tv.html` -> `public/tv.js`
- **Controller**: Vanilla JS state machine (`playState`, `advanceSlide()`)
- **Media Element**: `HTMLVideoElement` (`v360-video`), `HTMLAudioElement` (`v360-audio`), `<img class="v360-still">`
- **Manifest Source**: `localStorage` (`v360-tv-current-manifest`) / `/api/device/sync`
- **Controls**: None (loop infinito automático)
- **Cleanup**: `stopVideoElement`, `stopAudioElement`, `URL.revokeObjectURL`
- **Device Lifecycle**: Heartbeat (`doHeartbeat()` via `/api/device/heartbeat`)

## Landing/Demo
- **Entrypoint**: Assumed to be Admin/Demo previews (`playlist-timed-preview.tsx`, `content-visual.tsx`)
- **Controller**: Re-uses components but not the device `DisplayEngine` loop.
