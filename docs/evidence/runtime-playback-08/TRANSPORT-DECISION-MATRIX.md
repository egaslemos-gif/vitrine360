# RUNTIME-PLAYBACK-08 — Transport Decision Matrix

Date: 2026-09-26

Values: **PASS** | **PARTIAL** | **UNKNOWN** | **FAIL**  
Scores are evidence-backed classifications, not preference weights.

| Criterion | Polling | Long Polling | SSE | WebSocket (Vercel) | Managed Realtime | Redis/KV signal alone | Message broker (backend) |
|-----------|---------|--------------|-----|--------------------|------------------|-----------------------|--------------------------|
| Compatibility (HTTP Device path) | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | N/A (server) | N/A (server) |
| Vercel fit | PASS | PARTIAL (hold duration) | PARTIAL* | PARTIAL* (beta, maxDuration) | PASS (sidecar) | PARTIAL (extra infra) | PARTIAL |
| Multi-instance | PASS | PASS if DB-backed | FAIL without shared store | FAIL without shared store | PASS | PASS | PASS |
| Hisense Sraf | PASS (fetch proven) | UNKNOWN | **UNKNOWN** | **UNKNOWN** | UNKNOWN (SDK) | N/A | N/A |
| Latency | PARTIAL (interval-bound) | PARTIAL–PASS | PASS | PASS | PASS | depends | depends |
| Scalability | PARTIAL at 5k–10k×short T | PARTIAL | PARTIAL+infra | PARTIAL+infra | PASS (vendor) | PARTIAL | PASS |
| Complexity | PASS (lowest) | PARTIAL | FAIL if naive memory | FAIL if naive memory | PARTIAL (vendor) | PARTIAL | PARTIAL |
| Security (Device Bearer) | PASS | PASS | PARTIAL (EventSource auth limits) | PARTIAL | PARTIAL (token model) | PASS server-side | PASS |
| Reconnect | PASS (next poll) | PARTIAL | PASS (browser) / UNKNOWN Hisense | PARTIAL (must code) | PASS (vendor) | N/A | N/A |
| Offline | PASS (TTL expire) | PASS | PASS | PASS | PASS | PASS | PASS |
| Fallback role | **Is the fallback** | Possible | Needs polling fallback | Needs polling fallback | Needs polling fallback | — | — |
| Operational burden | PASS | PARTIAL | PARTIAL–FAIL | PARTIAL–FAIL | PARTIAL (vendor ops) | PARTIAL | PARTIAL |
| Cost (qualitative) | Predictable RPS | Medium | Medium+store | Medium+store | Vendor | Store | Store |
| Observability | PASS (HTTP logs) | PASS | PARTIAL | PARTIAL | Vendor dashboards | PARTIAL | PASS |

\*SSE/WS streaming on Vercel Functions is DOCUMENTED, but **cross-instance delivery requires an external store**; connections are not infinite. (Vercel KB + WebSockets docs)

## Candidate architectures

### OPTION A — Polling-first

- Command inbox (DB) + device polls (dedicated or sync piggyback)
- Device Bearer auth
- RP-07 dispatcher unchanged
- Fallback: n/a (polling is resilient path)

### OPTION B — Realtime-first + polling fallback

- SSE or WS primary after Hisense validation + shared store
- Polling fallback for unsupported runtimes / reconnect gaps

### OPTION C — Managed realtime + polling fallback

- Pusher/Ably/Supabase Realtime (etc.) for fan-out
- Polling fallback; Device-scoped tokens; no admin JWT on device

### OPTION D — WebSocket on Vercel Fluid (additional)

- Technically possible (Public Beta DOCUMENTED)
- Still needs external pub/sub for Admin→Device when instances differ
- Hisense UNKNOWN; maxDuration reconnect mandatory

## Recommendation derivation

| Priority criterion | Winner |
|--------------------|--------|
| 1 Security | Polling / managed with device tokens |
| 2 Vercel compatibility | Polling |
| 3 Device compatibility | Polling (only path with Hisense FACT for fetch) |
| 4 Reliability | Polling + TTL + idempotency |
| 5 Simplicity | Polling |
| 6 Scalability | Polling OK to mid scale; managed/realtime later |
| 7 Fallback | Polling |
| 8 Operational complexity | Polling |

**PRIMARY TRANSPORT: HTTP polling of a server-side command inbox**  
**FALLBACK: same polling channel (with backoff); optional future realtime as enhancement after Hisense physical validation**

R2: excluded as transport.  
Global in-memory EventEmitter: **REJECTED**.
