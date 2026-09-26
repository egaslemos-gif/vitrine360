# RUNTIME-PLAYBACK-09 — Pre-Implementation Audit

Date: 2026-09-26  
**Rule:** Written before schema/API implementation in this phase.

---

## A. Command domain (RP-07)

| Item | Location |
|------|----------|
| DeviceCommand | `src/domain/device-command.ts` |
| TTL | MIN 1s / DEFAULT 10s / MAX 60s — **T-05: default 10s conflicts with sync 10–20s** |
| Mapping | `src/domain/command-mapping.ts` |
| Authz | `src/domain/command-authorize.ts` → `manage_devices` |
| Dispatcher | `src/player/command/command-dispatcher.ts` |
| Local idempotency | `src/player/command/idempotency-store.ts` (not durable) |
| Local transport | `src/player/command/local-command-transport.ts` |

## B. Device HTTP channels

| Channel | Path | Cadence | Auth |
|---------|------|---------|------|
| Heartbeat | POST `/api/device/heartbeat` | 30s | Device Bearer |
| Sync | GET `/api/device/sync` | 10–20s | Device Bearer |
| Bootstrap / manifest / media | existing | — | Device Bearer |

Rate limits: sync 120/60s; bootstrap 30/60s.

## C. Auth / RBAC / DB

| Item | Location |
|------|----------|
| authenticateDevice | `src/services/devices.ts` |
| requireSession(permission) | `src/lib/auth.ts` |
| Admin devices pattern | `src/app/api/admin/devices/[id]/assign/route.ts` |
| Schema | `src/db/schema.ts` (sqlite / libsql) |
| Migrations | `drizzle/*.sql` + `ensureSchema()` self-heal |
| Activity | `src/services/activity-log.ts` |
| Allocation lock | `withTenantAllocationLock` — **quota-specific; do not reuse for command claim** |

## D. Gaps

| ID | Gap |
|----|-----|
| G-01 | No durable command inbox table |
| G-02 | No remote enqueue / poll / ack APIs |
| G-03 | No claim/lease |
| G-04 | TTL vs poll cadence unresolved (RP-08 T-05) |
| G-05 | Player has no remote poller |
| G-06 | Legacy tv.js not in scope for remote commands |

## E. Forbidden

SSE, WebSocket, Redis/KV, managed realtime, production deploy, sync response mutation before decision (decision: separate endpoint — see COMMAND-TRANSPORT-DECISION.md).
