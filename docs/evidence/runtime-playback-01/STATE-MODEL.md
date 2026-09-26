# STATE-MODEL — RUNTIME-PLAYBACK-01

## Types

Source: `src/domain/playback-state.ts`

### PlaybackStatus

`IDLE | LOADING | PLAYING | PAUSED | STOPPED | ENDED | ERROR`

### RepeatMode

`NONE | PLAYLIST | ITEM`

### PlaybackError

`code`, `message`, `contentId?`, `recoverable`, `occurredAt`

### PlaybackState

Includes playlist identity (`playlistId`, `currentItemIndex`, `currentContentId`, `currentPlaylistItemId`), `manifestVersion`, position/duration, volume/mute, repeat/shuffle, error, `updatedAt`, `generation`.

### ContentType

Reuses `@/domain/types` `ContentType`. No second enum. GIF is not a ContentType — treated as IMAGE slide timing.

## durationMs

- State `null` = unknown / awaiting natural media metadata
- Item `0` = natural VIDEO/AUDIO (legacy DisplayEngine / tv.js convention)
- State never uses `0` as “unknown”

## Orthogonal domains (not in PlaybackState)

- RuntimeCapabilities / fullscreen / touch
- Presence ONLINE/OFFLINE
- Sync CURRENT/STALE
- Service worker
