# ADR-RUNTIME-PLAYBACK-009 — Durable Command Inbox & HTTP Polling

## Status

Accepted — 2026-09-26

## Context

RP-08 selected HTTP polling + durable inbox. RP-07 provided DeviceCommand + CommandDispatcher without network. Sync cadence (10–20s) is too coarse for short-TTL commands and must not change for legacy compatibility.

## Decision

1. Persist commands in `device_command_inbox` (SQLite/libsql).
2. Expose dedicated Device Bearer poll/ACK routes; do not modify sync payload.
3. Admin enqueue via `POST /api/admin/devices/[id]/commands` with `manage_devices`.
4. Atomic claim with per-device in-process lock + transaction + short lease; redelivery on lease expiry within TTL.
5. Remote default TTL 30s; poll every 5s.
6. Wire React Player poller only; leave `tv.js` unwired.
7. No SSE/WS/Redis/managed realtime.

## Consequences

- Remote control works over existing Device Bearer HTTP.
- At-least-once delivery with idempotent apply.
- Extra poll RPS ≈ N/5 (ESTIMATE); acceptable for mid-scale.
- Future push transport can feed the same inbox/dispatcher without changing playback SoT.
