# Device Lifecycle

## Pairing flow

```
Player opens → POST /api/device/pair/start
  → creates Device PENDING + short-lived activation_code
Admin enters code in Console → POST /api/admin/devices/pair
  → name, location, device_code
  → status ACTIVE, issues device_token (hash stored)
Player polls /bootstrap with code → receives token once
  → stores token locally (IndexedDB)
```

Never place admin credentials in the Player.

## Status machine

```
PENDING ──pair──► ACTIVE
ACTIVE ──admin──► DISABLED
DISABLED ──admin──► ACTIVE
ACTIVE/DISABLED ──heartbeat window──► derived ONLINE | OFFLINE (UI)
```

Persisted `OFFLINE` may be written by a maintenance job after prolonged silence; UI always shows derived presence from `last_seen_at`.

## Heartbeat window

`SystemSetting.heartbeat_offline_after_ms` default **90_000**. Absence ≠ immediate hardware failure.

## Recovery on boot

```
BOOT → load local config/token/manifest → validate cache → PLAY
     → when network: heartbeat → version check → sync
```

Do not block boot on network.
