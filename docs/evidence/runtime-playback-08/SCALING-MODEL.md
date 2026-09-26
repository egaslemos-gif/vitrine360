# RUNTIME-PLAYBACK-08 — Scaling Model

**All figures below are ESTIMATES (mathematical projections), not benchmarks.**

## Existing load (baseline FACT)

| Channel | Interval | Req/device/min |
|---------|----------|----------------|
| Heartbeat | 30s | 2 |
| Sync | 10–20s | 3–6 |
| Combined (approx) | — | ~5–8 |

## Polling command inbox — ESTIMATE

Assume dedicated poll interval **T** seconds:  
`requests/sec ≈ N / T`

| Devices N | T=5s | T=10s | T=20s |
|-----------|------|-------|-------|
| 100 | 20 rps | 10 rps | 5 rps |
| 500 | 100 rps | 50 rps | 25 rps |
| 1,000 | 200 rps | 100 rps | 50 rps |
| 5,000 | 1,000 rps | 500 rps | 250 rps |
| 10,000 | 2,000 rps | 1,000 rps | 500 rps |

Latency bound ≈ T (plus server processing).  
If command TTL = 10s and T = 20s, many commands expire before delivery — **architectural conflict** (see ADR).

Piggyback on sync: adds payload bytes, not necessarily extra RPS.

## SSE / WebSocket — ESTIMATE

| Metric | Projection |
|--------|------------|
| Concurrent connections | ≈ N (one per online device) |
| Messages/min | Low (command rate << connection count) |
| Cross-instance coordination | External store ops per publish (Redis/KV/managed) |
| Reconnect storm after deploy | Up to N reconnects within seconds — need jitter |

Vercel WS: connection pinned per instance; closes at `maxDuration` (Hobby/Pro defaults documented 300s; higher plan ceilings). Reconnect expected. (DOCUMENTED — Vercel)

Global in-memory fan-out: **REJECTED** for production multi-instance. (FACT + Vercel docs)

## DB as signal — ESTIMATE

| Poll N devices @ T | DB reads/sec ≈ N/T |
|--------------------|--------------------|
| Same table as sync | Shared load with manifest |
| High-frequency broker | Not recommended without evidence |

Turso/SQLite can hold a **command inbox** with TTL cleanup; it should not replace a high-frequency event bus without capacity evidence. (INFERENCE)

## Storage ops (inbox)

Per command: 1 insert + 1+ poll reads + 1 ack/update + TTL delete.  
At low human-driven command rates, storage is cheap relative to poll RPS.

## Cost (qualitative only — no invented prices)

| Approach | Cost driver |
|----------|-------------|
| Polling | Function invocations ∝ N/T |
| SSE/WS on Vercel | Long-lived connections + memory; Active CPU on message handling; still needs shared store for fan-in from Admin |
| Managed realtime | Vendor connection + message pricing |
| Redis/KV signaling | Connection pool + ops; ops complexity |
| DB inbox | DB rows + poll reads |

Official price lookup deferred unless product requires — not blocking this audit.
