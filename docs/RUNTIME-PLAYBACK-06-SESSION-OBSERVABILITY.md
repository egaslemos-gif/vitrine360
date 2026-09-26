# RUNTIME-PLAYBACK-06 — Player Session, Playback Observability & Runtime Telemetry

Date: 2026-09-26

## Principle

Four separate dimensions — never fused:

| Dimension | Meaning | Authority |
|-----------|---------|-----------|
| PlaybackState | What the playback engine is doing | PlaybackController |
| RuntimeState | How the player runtime operates | Runtime store |
| Presence | Device contactability | lastSeenAt / derivePresence |
| SyncState | Manifest sync health | RuntimeState.syncState |

**PlayerSession** and **PlaybackObservation** are projections. Telemetry is observation-only and never controls playback.

## PlayerSession

- Created client-side after hydration (`useEffect` when phase=playing / lab mount).
- New `sessionId` on each boot/reload.
- `lastActivityAt` updates on status/item/volume/mute/repeat/seek/sync/error — **not** on timeupdate ticks.

## PlaybackObservation

Derived from `PlaybackState`: status, content/playlist ids, position, duration (null preserved), generation, repeat, error.

Compact heartbeat field `playback` + `sessionId` — language: **OBSERVED**.

## Telemetry

Events: SESSION_STARTED/READY, PLAYBACK_*, ITEM_CHANGED, SYNC_*, RUNTIME_ERROR.

- Bounded in-memory queue (64, drop-oldest)
- Deduplication (2s window)
- Sanitization of URLs / Bearer / signatures
- Failure never blocks PLAY/PAUSE/NEXT

No persistent offline warehouse; no IndexedDB telemetry; no per-frame events.

## Admin

Device observability shows observed status, session slice, position snapshot, generation, error code — separate from Presence badge.

## Globals (dev)

- `__v360_player_session`
- `__v360_playback_observation`

## Non-goals

No remote commands, WebSocket, SSE, DB migration, production deploy.
