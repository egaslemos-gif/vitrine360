# MEDIA-RUNTIME-01: PRE-IMPLEMENTATION AUDIT

## 1. Playlist Editor
**Location:** `src/features/playlists/playlist-builder.tsx`
- **State:** The editor supports setting a custom duration override (seconds converted to ms).
- **Rules:** `durationOverrideMs = 0` means "Natural" duration. `null` falls back to the content's default `durationMs`.
- **UI Presentation:** Correctly displays "Natural" when duration is 0, otherwise formats the duration as MM:SS.

## 2. Playlist Preview
**Location:** `src/features/playlists/playlist-timed-preview.tsx`
- **State:** Operates using an independent `setInterval` (100ms) tick loop.
- **Rules:** If `item.durationMs === 0` (Natural VIDEO/AUDIO), the timer effectively bypasses progression and relies on the native `<video>` / `<audio>` `ended` event. For fixed durations, the interval forces an index change.
- **Issue:** Uses a separate timing implementation compared to the actual Player (`PresentationTimer`). Could lead to discrepancies.

## 3. Content Duration
**Location:** `src/services/manifest.ts` & `src/player/playback/playlist-map.ts`
- **State:** The manifest resolver sets the final item duration as `item.durationOverrideMs ?? content.durationMs`. 
- **Semantics:** By the time the Player receives the items, `durationMs` is fully resolved. A duration of `0` strictly implies natural timing.

## 4. PlaylistItem durationOverrideMs
**Location:** `src/app/admin/playlists/actions.ts` / `src/features/playlists/playlist-builder.tsx`
- **State:** Handled properly in the database and forms. Null means fallback, 0 means natural, >0 means fixed override.

## 5. Manifest Builder
**Location:** `src/services/manifest.ts`
- **State:** Successfully fetches the playlist and resolves durations and assets. Converts database rows into `ManifestItem[]` used by the runtime.

## 6. PlaybackController
**Location:** `src/player/playback/playback-controller.ts`
- **State:** The source of truth for playlist progression, play/pause state, seeking, and repeat policies.
- **Rules:** Exclusively responds to dispatched actions (`MEDIA_ENDED`, `NEXT`, `PREVIOUS`). Checks `generation` on incoming events to ignore stale callbacks.

## 7. PlaybackState
**Location:** `src/domain/playback-state.ts`
- **State:** Contains robust timing, generation, status (`PLAYING`, `PAUSED`, etc.), and volume/mute properties.

## 8. Renderer Adapter
**Location:** `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Mounts the appropriate React component/DOM nodes based on media type.
- **Lifecycle:** Automatically calls `disposeMediaElement` on the old `mediaRef.current` when the `generation` changes.
- **Timers:** Instantiates a `PresentationTimer` if `usesPresentationTimer(item)` is true (i.e., fixed duration items or still media).

## 9. ensure-media-playback.ts
**Location:** `src/player/playback/ensure-media-playback.ts`
- **State:** Implements a robust `ensureMediaPlayback()` function that handles autoplay policies.
- **Logic:** Tries to play audibly; if rejected, falls back to muted play; if that is also rejected, it reports an unrecoverable `MEDIA_PLAY_ERROR`.

## 10. disposeMediaElement()
**Location:** `src/player/playback/ensure-media-playback.ts`
- **State:** Nullifies all native event listeners (`onended`, `onerror`, `onplay`, etc.). Pauses the element, removes the `src` attribute, and calls `.load()` to force release.

## 11. VIDEO Renderer
**Location:** `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Renders as `HTMLVideoElement`.
- **Timing:** Resolves `nativeEnded = (duration === 0)`. If natural, relies on `<video onEnded>`. If fixed (`duration > 0`), the `PresentationTimer` will trigger a synthetic ended event via the controller.
- **Risk:** If a fixed duration video finishes naturally before the timer (e.g. video is 5s but duration is set to 10s, or timer and video end simultaneously), it could trigger dual progression if not guarded properly by generation and controller state.

## 12. AUDIO Renderer
**Location:** `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Renders as a hidden `<video>` element with `opacity: 0.01` and `width: 1`.
- **Reason:** Bypasses strict browser autoplay policies that frequently block muted `<audio>` elements, breaking playlist automation. Smart TVs and Chromium allow `<video muted playsInline>` to start reliably.
- **Timing:** Shares the same `nativeEnded` vs timer logic as the VIDEO renderer.

## 13. IMAGE Renderer
**Location:** `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Renders as `<img>`.
- **Timing:** Immediately dispatches `MEDIA_READY` upon URL load. Relies entirely on `PresentationTimer`.

## 14. GIF Renderer
**Location:** `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Treats GIFs similar to images but forces the `image/gif` MIME type when fetching as a Blob to ensure Chromium correctly animates them.

## 15. DisplayEngine
**Location:** `src/player/playback/display-engine.tsx`
- **State:** React orchestrator. Wires up `PlaybackController` and `PlaybackRendererAdapter`. It does not make any playlist progression decisions itself.

## 16. Experience Renderer
**Location:** `src/player/playback/experience-slide.tsx`
- **State:** Handles interactive HTML/JS apps. Timing is classified as `EXPERIENCE_HOSTED`, meaning the presentation timer dictates duration.

## 17. Playback Controls
**Location:** `src/player/playback/playback-controls.tsx`
- **State:** Pure UI layer. Dispatches `PLAY`, `PAUSE`, `NEXT`, `PREVIOUS`, `SEEK`, `SET_VOLUME`, `SET_MUTED` actions to the `PlaybackController`. Does not manipulate media elements directly.

## 18. Repeat Logic
**Location:** `src/player/playback/playback-controller.ts`
- **State:** Fully encapsulated within the controller. `onMediaEnded()` determines whether to loop the playlist, repeat the item, or stop.

## 19. Generation Lifecycle
**Location:** `src/player/playback/playback-controller.ts` & `src/player/playback/playback-renderer-adapter.tsx`
- **State:** Every playlist transition increments `generation`. All media events (`onTimeUpdate`, `onEnded`, `onReady`) contain a generation token. If the token does not match the controller's current generation, the event is safely dropped. This mechanism prevents stale callbacks from disrupting the current media item.
