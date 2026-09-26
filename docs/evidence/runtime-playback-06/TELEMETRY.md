# RUNTIME-PLAYBACK-06 — TELEMETRY

## Events

| Event | When |
|-------|------|
| PLAYER_SESSION_STARTED | Session store.start |
| PLAYER_SESSION_READY | First non-IDLE playback observation |
| PLAYBACK_STARTED / PAUSED / STOPPED / ENDED / ERROR | Status transition |
| PLAYBACK_ITEM_CHANGED | contentId or playlistItemId change |
| SYNC_COMPLETED / SYNC_ERROR | noteSync from sync engine |
| RUNTIME_ERROR | noteRuntimeError |

## Queue

- Capacity 64, drop-oldest
- Dedupe window 2s on session+type+generation+content+item+errorCode
- Enqueue never throws into playback path

## Sanitization

- URLs → `[url]`
- Bearer / JWT-like / signed query → `[redacted]`
- assertTelemetryPayloadSafe rejects credential keys

## Non-events

No PLAYBACK_TIMEUPDATE per frame. Position only in compact heartbeat snapshot.
