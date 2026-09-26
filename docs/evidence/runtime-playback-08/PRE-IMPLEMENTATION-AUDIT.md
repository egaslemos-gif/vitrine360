# RUNTIME-PLAYBACK-08 — Pre-Implementation Audit

Date: 2026-09-26  
Scope: Command transport architecture only. **No transport code changed.**

Evidence class legend: **FACT** | **TESTED** | **DOCUMENTED** | **INFERENCE** | **UNKNOWN**

---

## A. Command / playback stack (RP-01…07)

| Concern | Location | Class |
|---------|----------|-------|
| DeviceCommand | `src/domain/device-command.ts` | FACT |
| Mapping | `src/domain/command-mapping.ts` | FACT |
| Authz boundary | `src/domain/command-authorize.ts` (`manage_devices`) | FACT |
| CommandDispatcher | `src/player/command/command-dispatcher.ts` | FACT |
| Idempotency (local) | `src/player/command/idempotency-store.ts` | FACT |
| LocalCommandTransport | `src/player/command/local-command-transport.ts` | FACT |
| Command Lab (dev) | `src/player/command/command-lab-panel.tsx`, `/player/lab` | FACT |
| PlaybackController | `src/player/playback/playback-controller.ts` | FACT |
| PlaybackState / PlaybackAction | `src/domain/playback-state.ts` | FACT |
| PlayerSession | `src/domain/player-session.ts`, `src/player/session/` | FACT |
| PlaybackObservation | `src/domain/playback-observation.ts` | FACT |
| RuntimeState | `src/player/runtime/state.ts` | FACT |
| SyncState | RuntimeState.syncState | FACT |

**Invariant confirmed:** COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION. Transport is absent in production. (FACT)

---

## B. Device authentication

| Item | Detail | Class |
|------|--------|-------|
| Mechanism | `Authorization: Bearer <deviceToken>` | FACT |
| Implementation | `authenticateDevice` in `src/services/devices.ts` | FACT |
| Storage | `devices.deviceTokenHash`; expiry + DISABLED/PENDING deny | FACT |
| Tenant operable gate | `isTenantOperable(tenantId)` | FACT |
| Admin JWT / cookies | **Must not** be sent to Device Runtime | DOCUMENTED (RP-07 + this audit) |

---

## C. Existing SERVER ↔ PLAYER channels

### C.1 Bootstrap — `POST /api/device/bootstrap`

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server |
| Auth | Pairing secret / activation code (pre-token) |
| Rate limit | 30 / 60s (`device-bootstrap`) |
| Actions | `pair_start`, `poll`, `claim` |
| Issues | Device Bearer on claim success |
| Class | FACT (`src/app/api/device/bootstrap/route.ts`, `player-app.tsx`) |

### C.2 Heartbeat — `POST /api/device/heartbeat`

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server |
| Frequency | **30s** interval + immediate pulse on play phase | 
| Auth | Device Bearer |
| Payload | timestamp, playerVersion, runtimeState, policy, diagnostics, sessionId, playback (observed) |
| Response | `manifestVersion`, `deviceConfig` slice |
| Authority | Observational only — not command authority |
| Class | FACT (`heartbeat/route.ts`, `player-app.tsx` ~614–616) |

### C.3 Sync — `GET /api/device/sync?version=`

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server |
| Frequency | **20s** when playlist non-empty; **10s** when empty | 
| Auth | Device Bearer |
| Rate limit | 120 / 60s |
| Payload out | `upToDate`, `manifest`, `changedAssetIds` |
| Offline | fetch fails → null; `online` event triggers sync |
| Class | FACT (`sync/route.ts`, `engine.ts`, `player-app.tsx` ~619–628) |

### C.4 Manifest — `GET /api/device/manifest`

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server |
| Auth | Device Bearer |
| Role | Full manifest fetch (alongside sync delta) |
| Class | FACT |

### C.5 Media — `GET /api/device/media/[assetId]` (+ signed R2 URLs)

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server / R2 |
| Auth | Device Bearer for app routes; **no** Bearer on signed R2 URLs |
| Class | FACT |

### C.6 Experience admit — `POST /api/device/experience/admit`

| Attribute | Value |
|-----------|-------|
| Direction | Player → Server |
| Auth | Device Bearer |
| Class | FACT |

### C.7 Admin presence poll — `GET /api/admin/devices/presence`

| Attribute | Value |
|-----------|-------|
| Direction | Admin Console → Server |
| Role | Presence/observability aggregation (not device command path) |
| Class | FACT |

---

## D. Presence vs commandability

| Concept | Meaning | Class |
|---------|---------|-------|
| ONLINE / AWAY / OFFLINE | Derived from lastSeen / heartbeat freshness | FACT |
| ONLINE ≠ commandable | Presence is observation; transport may be disconnected | DOCUMENTED (RP-06/07) |

UI copy: ONLINE ≈ heartbeat recente; OFFLINE ≈ >15 min without heartbeat (`device-configuration-help.tsx`). (FACT)

---

## E. Tenant / RBAC

| Layer | Notes | Class |
|-------|-------|-------|
| Device scoped by `tenantId` | authenticateDevice + operable tenant | FACT |
| Command authz | `authorizeDeviceCommand` + `manage_devices` | FACT |
| Cross-tenant | Deny | FACT (RP-07 tests) |
| No remote-control entitlement yet | Documented future | DOCUMENTED |

---

## F. Gaps for remote transport

| ID | Gap | Sev |
|----|-----|-----|
| T-01 | No remote command API / inbox | HIGH (expected for RP-08) |
| T-02 | No durable command queue | HIGH (expected) |
| T-03 | No SSE/WS/managed realtime | INFO (correct) |
| T-04 | Local idempotency not multi-instance durable | MEDIUM (RP-07 INFO) |
| T-05 | RP-07 TTL default 10s vs sync poll 10–20s — latency mismatch for polling delivery | MEDIUM (architecture) |
| T-06 | Hisense EventSource/WebSocket not physically validated | HIGH for realtime-first |
| T-07 | Global in-memory EventEmitter unsuitable on Vercel multi-instance | FACT (platform + prior PI-10M) |

---

## G. Forbidden shortcuts (this phase)

- No SSE / WebSocket / long-poll implementation
- No Redis / KV / Pusher / Ably / broker dependencies
- No command API / DB migration
- No PlaybackController / timing / Experience / Runtime Policy changes
- No production deploy
- No claiming Hisense realtime capability without physical evidence

---

## H. Implementation plan (post-audit — **not executed in RP-08**)

RP-08 ends at architecture. Future RP-09 = transport foundation per ADR.
