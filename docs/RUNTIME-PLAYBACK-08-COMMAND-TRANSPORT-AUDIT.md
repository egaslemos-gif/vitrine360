# RUNTIME-PLAYBACK-08 — Command Transport Audit & Remote Control Architecture

Date: 2026-09-26  
**Phase type:** AUDIT + ARCHITECTURE only — **no transport implementation**.

## Invariant

```
COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION
```

Target flow:

```
Admin/Console → Command Creation → Authorization → Transport
  → Device Runtime → CommandDispatcher → PlaybackController → PlaybackState
```

## Current state (summary)

Production Device Runtime already uses **HTTP polling**:

| Channel | Interval | Auth |
|---------|----------|------|
| Heartbeat | 30s | Device Bearer |
| Sync | 10–20s | Device Bearer |

RP-07 provides DeviceCommand + CommandDispatcher + local idempotency.  
No SSE/WS/Redis/managed realtime/command API exists.  
R2 remains media storage only.

See: `docs/evidence/runtime-playback-08/PRE-IMPLEMENTATION-AUDIT.md`

## Transport candidates (evaluated, not built)

| Candidate | Verdict sketch |
|-----------|----------------|
| Polling | Best fit for Vercel + proven Device `fetch` |
| Long polling | Possible; NOT RECOMMENDED as primary (serverless hold cost) |
| SSE | Chromium OK; Hisense UNKNOWN; needs shared store on Vercel |
| WebSocket | Vercel Public Beta + Fluid; instance pin + maxDuration; Hisense UNKNOWN; needs shared store for Admin→Device fan-in |
| Managed realtime | Viable later; vendor lock-in; still needs polling fallback |
| Redis/KV signaling | Required **adjunct** for any multi-instance push — not a device transport alone |
| Message broker | Backend fan-out; not a browser transport |

## Serverless constraints (REJECT)

Any design relying on:

- process-global singleton memory
- in-process EventEmitter as the only bus
- sticky assumption without external coordination

→ **REJECTED** for production on Vercel multi-instance. (DOCUMENTED)

## Delivery model

- Transport: **at-least-once**
- Command layer: **idempotent** (`commandId`)
- Offline: queue within TTL, else expire
- Presence ONLINE ≠ transport connected ≠ commandable

## Queue options (architecture only)

| Option | Durability | Multi-instance | Notes |
|--------|------------|----------------|-------|
| In-memory | No | No | Lab only (RP-07) |
| Database inbox | Yes | Yes | Preferred for polling-first |
| Redis/KV | Yes (TTL) | Yes | Good for push signaling |
| Managed queue | Yes | Yes | Backend; still need device delivery path |

## Sync piggyback (hypothesis — not implemented)

`GET /api/device/sync` **could** later return `{ manifest, commands }` with strict schema separation and `Cache-Control: no-store`.  
Risk: coupling sync load to command urgency. Alternative: dedicated lightweight inbox poll at shorter T.

**TTL note:** RP-07 default TTL 10s vs sync 20s → remote commands need either faster poll or longer remote TTL.

## Architectural decision

| Role | Choice |
|------|--------|
| **PRIMARY** | HTTP **polling** of a durable **command inbox** (DB), Device Bearer authenticated |
| **FALLBACK** | Same polling path with backoff / online recovery (realtime not required for MVP remote control) |
| **Future enhancement** | SSE or managed realtime **only after** Hisense physical EventSource/WS validation + shared store |

## Implementation boundary

| Phase | Scope |
|-------|-------|
| **RP-08** | This audit + ADR + evidence |
| **RP-09** | Transport foundation (inbox + poll client) — **not started** |

## Documents

- ADR: `docs/adr/ADR-RUNTIME-PLAYBACK-008.md`
- Evidence: `docs/evidence/runtime-playback-08/`
