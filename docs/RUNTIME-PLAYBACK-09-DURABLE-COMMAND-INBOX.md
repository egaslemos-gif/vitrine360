# RUNTIME-PLAYBACK-09 — Durable Command Inbox & HTTP Polling

Date: 2026-09-26

## Decision (RP-08 → RP-09)

PRIMARY: HTTP polling of durable DB inbox  
Endpoints: separate from sync (OPTION A)

| Constant | Value |
|----------|-------|
| Poll interval | 5s |
| Remote default TTL | 30s |
| Lease | 15s |
| Max per poll | 10 |

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/admin/devices/[id]/commands` | Session + `manage_devices` |
| GET | `/api/device/commands` | Device Bearer · `Cache-Control: no-store` |
| POST | `/api/device/commands/[commandId]/ack` | Device Bearer · `Cache-Control: no-store` |

`/api/device/sync` **unchanged**.

## Flow

Enqueue (server clock) → QUEUED → poll claim (atomic + lease) → DELIVERED → Device CommandDispatcher → PlaybackController → ACK → ACKED/REJECTED/EXPIRED

## Semantics

- Delivery: at-least-once  
- Execution: idempotent (`commandId` + RP-07 dispatcher)  
- Ordering: `createdAt ASC, commandId ASC` per device  
- Offline: remain QUEUED until TTL → EXPIRED  
- Presence ≠ delivery  

## Player

React Player (`player-app.tsx`) runs `createCommandPoller`.  
Legacy `tv.js`: **not wired** (documented gap).

## Non-goals (still deferred)

SSE, WebSocket, Redis/KV, managed realtime, Admin remote-control UI, entitlements.
