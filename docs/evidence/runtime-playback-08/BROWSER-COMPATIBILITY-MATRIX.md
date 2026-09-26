# RUNTIME-PLAYBACK-08 — Browser Compatibility Matrix

Date: 2026-09-26

**Rule:** Chromium evidence ≠ Hisense evidence. Hisense/VIDAA/Sraf without physical test → **UNKNOWN**.

| Capability | Chromium (dev/lab) | Hisense Sraf | Evidence | Confidence | Blocking for polling? | Blocking for SSE/WS? |
|------------|--------------------|--------------|----------|------------|-----------------------|----------------------|
| `fetch` | YES | YES (used in production player path) | Player sync/heartbeat/media | HIGH | No | No |
| `AbortController` | YES | UNKNOWN | Not physically revalidated this phase | MEDIUM / UNKNOWN | No | Partial |
| Device Bearer over HTTPS | YES | YES (boot/sync path) | Production + acceptance docs | HIGH | No | No |
| `setInterval` timers | YES | PARTIAL / fragile background | Known TV limitation docs | MEDIUM | May affect poll cadence | Same |
| `online` / `offline` events | YES | UNKNOWN | Code listens; Hisense not retested | LOW–MEDIUM | No | No |
| `visibilitychange` | YES | UNKNOWN | — | UNKNOWN | No | No |
| Service Worker / IndexedDB durability | YES (lab) | FRAGILE / unreliable after reboot | `docs/ACCEPTANCE.md`, player-boot evidence | HIGH (limitation known) | N/A for transport | N/A |
| `EventSource` (SSE) | YES (MDN Baseline) | **UNKNOWN — NOT PHYSICALLY VALIDATED** | MDN / Can I Use for Chromium only | HIGH Chromium / NONE Hisense | No | **Yes until validated** |
| `WebSocket` | YES | **UNKNOWN — NOT PHYSICALLY VALIDATED** | MDN; Vercel docs for server | HIGH Chromium / NONE Hisense | No | **Yes until validated** |
| `ReadableStream` body | YES | UNKNOWN | — | UNKNOWN | No | Partial (SSE fetch) |
| `keepalive` fetch | YES | UNKNOWN | — | UNKNOWN | No | No |

## Physical Hisense test (this phase)

| Status | Result |
|--------|--------|
| Device available | **No physical session in this audit** |
| EventSource probe | **NOT EXECUTED** |
| WebSocket probe | **NOT EXECUTED** |
| Classification | **NOT PHYSICALLY VALIDATED** |

## Chromium lab note

`/player/lab` exercises LocalCommandTransport only (no network transport). Chromium confirms EventSource/WebSocket APIs exist in desktop Chromium — **not** transferable to Sraf. (TESTED locally for lab; DOCUMENTED for EventSource support via MDN.)
