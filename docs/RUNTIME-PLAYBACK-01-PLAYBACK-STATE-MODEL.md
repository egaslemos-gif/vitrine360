# RUNTIME-PLAYBACK-01 — Playback State Model

**Status:** Implementation complete (foundation)  
**Date:** 2026-09-26  
**Scope:** Canonical typed Playback State + Controller. No remote commands, DB, migrations, or Production deploy.

---

## 1. Current playback architecture

Dual runtimes exist today:

| Surface | Location | Behaviour |
|---------|----------|-----------|
| React Player | `src/player/playback/display-engine.tsx` | Playlist index, timers, VIDEO/AUDIO `onEnded`, EXPERIENCE via ExperiencePlaybackController |
| Legacy TV | `public/tv.js` | Self-contained clock/playlist loop for Hisense / fragile browsers |
| Landing Demo | Interactive Player Demo (UI/UX-02D) | Isolated mock — not production runtime |
| Experience | `ExperiencePlaybackController` | Separate domain (admission/sandbox/bridge) |

**Current flow (simplified):**

```
Manifest (sync) → DisplayEngine local state (index, timers)
                → Renderer (video/img/audio/experience)
                → onEnded / setTimeout → next index
```

There was no shared typed `PlaybackState`. Runtime diagnostics / heartbeat carry orthogonal `RuntimeState` (network, sync, fullscreen).

## 2. Target architecture

```
Manifest
   ↓
PlaybackController  ←── (future) Command Controller ← Remote Command
   ↓
PlaybackState (immutable snapshots)
   ↓
Renderer Adapter
   ↓
HTMLMediaElement / Image / GIF-as-IMAGE / Experience shell
```

RP-01 delivers the **contract + controller**. Wiring DisplayEngine to the controller is **RUNTIME-PLAYBACK-02**.

## 3. PlaybackState

See `src/domain/playback-state.ts`.

Fields: `status`, `playlistId`, `manifestVersion`, `currentItemIndex`, `currentContentId`, `currentContentType`, `currentPlaylistItemId`, `positionMs`, `durationMs`, `volume`, `muted`, `repeatMode`, `shuffle`, `error`, `updatedAt`, `generation`.

## 4. PlaybackStatus

`IDLE | LOADING | PLAYING | PAUSED | STOPPED | ENDED | ERROR`

## 5. PlaybackAction

Local controller intents: `PLAY`, `PAUSE`, `STOP`, `NEXT`, `PREVIOUS`, `RESTART`, `SEEK`, `SET_VOLUME`, `SET_MUTED`, `SET_REPEAT_MODE`, `LOAD_PLAYLIST`, plus media events `MEDIA_*`.

## 6. RepeatMode

`NONE | PLAYLIST | ITEM` — default `PLAYLIST` (matches current DisplayEngine wrap behaviour). Shuffle field exists; **no shuffle algorithm in RP-01**.

## 7. PlaybackError

`{ code, message, contentId?, recoverable, occurredAt }` — no stacks, secrets, bearers, or signed URLs.

## 8. State transitions

Defined in `PLAYBACK_TRANSITIONS` / `canTransition()`. Invalid transitions are no-ops.

## 9. Controller

`src/player/playback/playback-controller.ts` — pure domain. `getState()`, `subscribe()`, `dispatch()`.

## 10. Renderer boundary

Renderer emits media events with `generation`. Controller owns playlist NEXT/PREVIOUS/ENDED. DisplayEngine still owns rendering until RP-02.

## 11. Media lifecycle

`MEDIA_LOADING` → `MEDIA_READY` → time updates → `MEDIA_ENDED` / `MEDIA_ERROR`. IMAGE timing via `tickImageElapsed` (controller-owned).

## 12. Stale event protection

Monotonic `generation` bumped on every item select. Events with mismatched generation are ignored.

## 13. React integration

`usePlaybackState(controller)` — thin `useSyncExternalStore` subscribe/render. No playlist logic in React.

## 14. RuntimeState relationship

| Domain | Owns |
|--------|------|
| RuntimeState | network, sync health, fullscreen, orientation, cursor, capabilities |
| PlaybackState | media status, playlist position, volume, error |

Coexist; diagnostics may *observe* PlaybackState later — Controller remains SoT.

## 15. Presence relationship

ONLINE/OFFLINE ≠ PLAYING/PAUSED. Unchanged heartbeat presence.

## 16. Sync relationship

SYNC_CURRENT / STALE ≠ playback status. Manifest version on PlaybackState distinguishes *playing* vs *available* without merging sync machine.

## 17. Legacy Player compatibility

`public/tv.js` untouched. Future adapter may map tv.js clock → PlaybackState snapshots. Hisense path unchanged.

## 18. Landing Demo separation

Landing Interactive Player Demo remains local/isolated. Does **not** import production `PlaybackController`.

## 19. Security boundary

Controller has zero access to JWT, Device Bearer, AUTH_SECRET, R2, tenant auth. Receives already-resolved playlist items only.

## 20. Future Remote Control boundary

No `POST /api/device/{play,pause,next,command}`. Remote → Command Controller → PlaybackController is later phase.

---

## durationMs semantics

| Value | Meaning |
|-------|---------|
| `null` (state) | Unknown / natural media before metadata |
| `> 0` (state) | Known duration |
| `0` (playlist item) | Legacy natural VIDEO/AUDIO — preserved; mapped to `null` until `MEDIA_READY` |

Never use `durationMs = 0` on **state** to mean unknown.

## STOP / PAUSE / PLAY

- **STOP:** preserves playlistId/index/contentId; `positionMs = 0`; status STOPPED  
- **PAUSE:** preserves position  
- **PLAY:** PAUSED→resume; STOPPED/ENDED/ERROR→reload current from 0; IDLE→begin first/current  

## PREVIOUS

If `positionMs > 3000` → restart current; else previous item (matches suggested rule; DisplayEngine had no equivalent UI rule).
