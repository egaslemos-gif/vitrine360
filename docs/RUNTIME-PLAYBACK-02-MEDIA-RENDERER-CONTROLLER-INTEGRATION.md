# RUNTIME-PLAYBACK-02 — Media Renderer & Playback Controller Integration

**Status:** Implemented  
**Date:** 2026-09-26  
**Prerequisite:** RUNTIME-PLAYBACK-01 VALIDATED

---

## 1. Current architecture (pre RP-02)

```
Manifest → DisplayEngine (useState index + setTimeout) → Slide → onNaturalEnd/setIndex
```

## 2. RP-01 integration

`PlaybackController` + `PlaybackState` become the React Player SoT.

## 3. DisplayEngine responsibility

- Create stable `PlaybackController` (`useRef`)
- `LOAD_PLAYLIST` / `SYNC_PLAYLIST` from manifest items
- Subscribe via `usePlaybackState`
- Derive current item from `state.currentItemIndex`
- Expose `DisplayEngineHandle` (`dispatch` / `getState`) for future local/remote transport
- Cleanup: `STOP` on unmount

Does **not** own NEXT/PREVIOUS/ENDED/repeat.

## 4. PlaybackController responsibility

Playlist navigation, status, position, volume, mute, repeat, generation, errors, media lifecycle interpretation.

## 5. Renderer Adapter

`PlaybackRendererAdapter` — presentation + media events with `generation`. No playlist navigation.

## 6. Video

- Natural (`durationMs===0`): `loadedmetadata` → duration; `ended` → `MEDIA_ENDED`
- Explicit (`durationMs>0`): loops; presentation timer → `MEDIA_ENDED`

## 7. Audio

Same adapter path as VIDEO (natural vs explicit).

## 8. Image

`MEDIA_READY` then presentation timer → `MEDIA_ENDED`. Never calls `next()`.

## 9. GIF

IMAGE slide timing (no ContentType GIF).

## 10. Experience

`ExperiencePlaybackSlide` unchanged; type EXPERIENCE on state; timer uses item duration.

## 11. Generation

Key: `playlistItemId:contentId:g{generation}`. Stale events ignored.

## 12. Timers

Presentation timer cleans on generation/status/unmount. Does not restart on `positionMs` ticks.

## 13. Manifest changes

`SYNC_PLAYLIST` soft-remaps by `playlistItemId` / `contentId` without generation bump when identity matches.

## 14. Error handling

`MEDIA_ERROR` → Controller; stale generation ignored; natural video still has 2s fallback `MEDIA_ENDED`.

## 15. React integration

`usePlaybackState` + imperative handle. No duplicate `useState` index.

## 16. RuntimeState

`isPlaying` / `currentContentId` derived observations from PlaybackState. Controller remains SoT.

## 17. Legacy Player

`public/tv.js` untouched.

## 18. Landing Demo

Isolated; does not import PlaybackController.

## 19. Remote Control boundary

No device command APIs. Local actions available via `dispatch` for future transport.
