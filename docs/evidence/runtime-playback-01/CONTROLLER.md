# CONTROLLER — RUNTIME-PLAYBACK-01

## Class

`PlaybackController` — `src/player/playback/playback-controller.ts`

## API

- `getState()` — immutable snapshot
- `subscribe(listener)` → unsubscribe
- `dispatch(action)`
- Convenience: `play`, `pause`, `stop`, `next`, `previous`, `restart`, `seek`, `setVolume`, `setMuted`, `setRepeatMode`, `loadPlaylist`
- Media: `onMediaLoading`, `onMediaReady`, `onMediaTimeUpdate`, `onMediaEnded`, `onMediaError`, `tickImageElapsed`

## Responsibilities

State transitions, playlist navigation, position/duration, volume/mute, generation, media lifecycle coordination.

## Non-responsibilities

DOM/React render, database, JWT/Device Bearer, R2, tenant auth, remote command transport, shuffle algorithm.

## Snapshot immutability

Listeners receive `snapshotPlaybackState()` copies. `getState()` never returns the internal reference.
