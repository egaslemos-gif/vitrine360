# RUNTIME-PLAYBACK-08 — Sources

Official / primary sources used in this audit. Blogs used only as secondary pointers when citing official pages.

## Vercel

| Topic | URL | Used for |
|-------|-----|----------|
| WebSockets | https://vercel.com/docs/functions/websockets | Pinning, Fluid requirement, reconnect, no infinite hold |
| Publish/subscribe realtime KB | https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel | Multi-instance needs external store; SSE vs WS; polling for low-frequency; managed providers |
| Fluid Compute | https://vercel.com/docs/fluid-compute | maxDuration defaults / ceilings |
| Changelog — WebSocket Public Beta | https://vercel.com/changelog/websocket-support-is-now-in-public-beta | Beta status (2026-06-22) |
| Streaming functions | https://vercel.com/docs/functions (streaming docs referenced from KB) | SSE streaming pattern |

## Web APIs / browsers

| Topic | URL | Used for |
|-------|-----|----------|
| EventSource (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/EventSource | Chromium/desktop SSE support Baseline |
| Server-sent events (WHATWG) | https://html.spec.whatwg.org/dev/server-sent-events.html | Spec status |
| Can I Use EventSource | https://caniuse.com/eventsource | Desktop/mobile matrix (not Hisense) |

## Cloudflare (adjacent / non-primary for this deploy)

| Topic | URL | Used for |
|-------|-----|----------|
| Workers limits | https://developers.cloudflare.com/workers/platform/limits/ | Contrast only — project hosts on Vercel |

## Project-internal evidence

| Doc / code | Used for |
|------------|----------|
| `src/player/sync/engine.ts` | Heartbeat/sync fetch channels |
| `src/features/player/player-app.tsx` | 30s heartbeat; 10–20s sync |
| `src/app/api/device/*` | Auth, rate limits |
| `src/services/devices.ts` `authenticateDevice` | Device Bearer |
| `docs/RUNTIME-PLAYBACK-07-COMMAND-MODEL.md` | Command domain / TTL |
| `docs/ACCEPTANCE.md` / player-boot evidence | Hisense SW/IDB limitations |
| `docs/PLATFORM-IDENTITY-10M.md` | Rejection of in-process EventEmitter schedulers |

## Explicitly not used as primary authority

- Vendor marketing blogs without official doc cross-check
- Chromium lab results as proof of Hisense EventSource/WebSocket
