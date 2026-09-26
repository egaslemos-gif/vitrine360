# BOOT-FLOW — Legacy Player

```text
TV power on
  → browser opens /player or /tv.html
  → Smart TV UA → /tv.html?v=051
  → load /tv.js?v=051
  → readConfig() from localStorage (v360-player-config)
```

## Branches

| Condition | Behaviour |
|-----------|-----------|
| `deviceToken` present | `startPlayback` → sync/heartbeat → manifest → play (**no pairing**) |
| `deviceId` + `pairingSecret`, no token, not expired | resume claim / show code |
| pairing expired | `writeConfig(null)` then `startPairing` |
| no config | first boot → `startPairing` |
| HTTP **401** on authenticated GET/POST | `handleUnauthorized` → `writeConfig(null)` + reload |
| Sync network failure | reject / retry paths — **does not** clear pairing identity |

## Persistence

| Key | Store | Survives reboot (typical) |
|-----|-------|---------------------------|
| Device config (`deviceId`, `deviceToken`, …) | `localStorage` `v360-player-config` | Yes |
| Pairing client id / secret | `localStorage` | Yes |
| Cached manifest | `localStorage` | Best-effort |
| Media blobs | IndexedDB (optional) | Platform-dependent on Hisense |

## Explicit reset

`/player?reset=1` (React path) / documented reset flows clear identity.  
Normal boot must **not** call `writeConfig(null)` except expiry / 401 / explicit reset.
