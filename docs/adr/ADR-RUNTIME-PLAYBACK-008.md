# ADR-RUNTIME-PLAYBACK-008 — Command Transport Architecture

## Status

Accepted — 2026-09-26 (architecture only; no implementation)

## Context

RP-07 defined DeviceCommand and CommandDispatcher without network transport. Remote control requires a delivery path compatible with:

- Vercel Functions / Fluid multi-instance (no shared process memory)
- Existing Device Bearer HTTP channels (heartbeat 30s, sync 10–20s)
- Hisense/VIDAA/Sraf constraints (fetch proven; EventSource/WebSocket **not physically validated**)
- Short command TTL and idempotent execution
- Separation: COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION

Official Vercel documentation states WebSocket connections are pinned to one function instance, close at `maxDuration`, and cross-instance coordination requires an external store — module-level EventEmitters fail in production multi-instance.

## Decision

1. **PRIMARY TRANSPORT:** HTTP polling of a server-authoritative **command inbox** (durable store, preferably DB), authenticated with **Device Bearer**.
2. **FALLBACK:** The same polling mechanism (backoff on failure; deliver only non-expired, session-valid commands on reconnect).
3. **REJECT** global in-memory EventEmitter / singleton buses for production command fan-out.
4. **DEFER** SSE / WebSocket / managed realtime as **optional enhancements** until Hisense physical capability tests PASS and a shared store (Redis/KV/managed) is budgeted.
5. **EXCLUDE** R2 from command transport.
6. **RP-08 implements nothing**; RP-09 is the transport foundation boundary.

## Alternatives considered

| Alternative | Why not primary |
|-------------|-----------------|
| SSE-first | Hisense UNKNOWN; Vercel multi-instance needs external store |
| WebSocket-first (Vercel beta) | Same + maxDuration reconnect; Next.js upgrade is experimental helper; Hisense UNKNOWN |
| Long polling primary | Serverless hold cost; complexity vs short poll |
| Managed realtime primary | Vendor lock-in before device capability known; still needs fallback |
| Sync-only piggyback without inbox design | Couples manifest cadence to command urgency without TTL alignment |

## Constraints

- No admin JWT/cookies on Device Runtime
- Server-side authorization before enqueue
- At-least-once delivery + idempotent apply
- Command TTL fail-closed
- ONLINE presence ≠ commandable

## Evidence

See `docs/evidence/runtime-playback-08/SOURCES.md`, decision matrix, browser matrix, scaling model.

## Security implications

Device-scoped credentials only; `Cache-Control: no-store` on inbox responses; envelope fields untrusted; replay via commandId+TTL+binding.

## Operational implications

Poll RPS scales as N/T (ESTIMATE). Mid-scale (hundreds–low thousands) fits polling; very large fleets may later add push. Align remote TTL with poll interval in RP-09.

## Fallback

Polling remains the universal path for restricted TV browsers.

## Future implementation boundary

**RP-09 — Transport Foundation:** durable inbox schema, authorize+enqueue API (admin), device poll/ACK, wire into CommandDispatcher — still no requirement to ship SSE/WS.
