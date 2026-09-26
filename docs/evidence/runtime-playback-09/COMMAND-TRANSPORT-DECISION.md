# RUNTIME-PLAYBACK-09 — Command Transport Integration Decision

Date: 2026-09-26

## Options

| Option | Shape |
|--------|-------|
| **A** | Dedicated `GET /api/device/commands` (+ ACK endpoint) |
| **B** | Piggyback `commands[]` on `GET /api/device/sync` |
| **C** | Hybrid (sync optional hint + dedicated poll) |

## Criteria evaluation

| Criterion | A Separate | B Sync piggyback | Winner |
|-----------|------------|------------------|--------|
| Existing sync cadence (10–20s) | Independent poll interval | Bound to sync | **A** |
| Manifest payload size | Unaffected | Grows with commands | **A** |
| Backwards compatibility / legacy tv.js | Sync untouched | Response shape change | **A** |
| React Player vs legacy isolation | Wire React only | Forces both parsers | **A** |
| Failure isolation | Command poll fail ≠ sync fail | Coupled | **A** |
| Cache-Control no-store | Easy on one route | Must harden sync caching | **A** |
| Claim / ACK clarity | Dedicated lifecycle | Mixed with manifest | **A** |
| DB load | Extra RPS = N/T_cmd | Shares sync RPS | B slightly |
| Latency for short-TTL commands | T_cmd can be 5s | Worst case 20s | **A** |
| Device Bearer | Same | Same | Tie |

## TTL / poll resolution (T-05)

| Constant | Value | Rationale |
|----------|-------|-----------|
| `COMMAND_POLL_INTERVAL_MS` | **5000** | Sub-TTL delivery; fits rate limit headroom |
| `COMMAND_DEFAULT_TTL_MS` (remote) | **30000** | ≥ poll×2 + network + lease + margin |
| `COMMAND_LEASE_MS` | **15000** | Claim window before redelivery |
| `COMMAND_MIN_TTL_MS` / `MAX` | 1s / 60s | Keep RP-07 bounds |
| `MAX_COMMANDS_PER_POLL` | **10** | Bounded response |

RP-07 local DEFAULT 10s remains for in-process lab; **remote enqueue** uses transport default 30s unless caller specifies within bounds.

## Decision

**OPTION A — Separate endpoints**

- `POST /api/admin/devices/[id]/commands` — enqueue (session + `manage_devices`)
- `GET /api/device/commands` — poll + atomic claim (Device Bearer)
- `POST /api/device/commands/[commandId]/ack` — ACK (Device Bearer)

**Do not modify** `/api/device/sync` response contract in RP-09.

Legacy `tv.js`: **not wired** (documented gap).
