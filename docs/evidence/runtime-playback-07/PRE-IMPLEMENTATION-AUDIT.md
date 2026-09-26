# RUNTIME-PLAYBACK-07 — Pre-Implementation Audit

Date: 2026-09-26  
Scope: PlaybackAction, PlaybackController, PlayerSession, Device auth, RBAC, telemetry.

**Rule:** No RP-07 implementation changes were applied before this document was written.

---

## A. Existing action model

| Item | Location |
|------|----------|
| `PlaybackAction` | `src/domain/playback-state.ts` |
| Dispatch | `PlaybackController.dispatch(action)` |
| Control UI | `PlaybackControls` → `dispatch({ type })` only |

**Playback control actions (eligible for DeviceCommand):**

`PLAY | PAUSE | STOP | NEXT | PREVIOUS | RESTART | SEEK | SET_VOLUME | SET_MUTED | SET_REPEAT_MODE`

**Not remote-command candidates:** `LOAD_PLAYLIST`, `SYNC_PLAYLIST`, `MEDIA_*` (renderer → controller).

**Volume scale:** 0–1 (`clampVolume`). Repeat: `NONE | PLAYLIST | ITEM`.

---

## B. Existing authentication

| Path | Mechanism |
|------|-----------|
| Device APIs | `authenticateDevice(Authorization Bearer)` — Device Bearer |
| Admin APIs | session / JWT / Google OAuth |
| Experience admit | Device Bearer |

No DeviceCommand API exists. Marketing copy mentions “Remote control” as future — no implementation.

---

## C. Existing authorization

| Layer | Notes |
|-------|-------|
| Tenant RBAC | `Permission` / `ROLE_PERMISSIONS` in `src/domain/types.ts` |
| Platform | `platform-identity` permissions |
| Experience | package permissions + admission |

**Gap:** No `devices.control` / remote-control permission yet. RP-07 documents required permission as future: `devices.control` (or map to existing devices admin write if present). Authorization boundary function stubbed as fail-closed interface; local harness uses explicit test context.

---

## D. Session identity

| Item | Location |
|------|----------|
| `PlayerSession.sessionId` | `src/domain/player-session.ts` |
| Store | `src/player/session/player-session-store.ts` |
| Fields | `deviceId`, `tenantId`, lifecycle |

Session is projection — suitable for **session binding** on commands.

---

## E. Tenant isolation

Devices scoped by `tenantId`. Heartbeat / observability already assert no token exposure. Commands must require `Command.tenantId === Device.tenantId` (fail closed).

---

## F. Gaps

| ID | Gap | Sev |
|----|-----|-----|
| G-01 | No DeviceCommand domain | HIGH |
| G-02 | No Command → PlaybackAction mapper | HIGH |
| G-03 | No CommandDispatcher | HIGH |
| G-04 | No TTL / expiry / idempotency | HIGH |
| G-05 | No session-binding policy for commands | MEDIUM |
| G-06 | No local command harness / Command Lab | MEDIUM |
| G-07 | No remote-control permission in RBAC | LOW (document) |
| G-08 | No network transport (correct for RP-07) | INFO |

---

## G. Forbidden shortcuts

- No SSE/WebSocket/long-poll
- No `POST /api/device/play|pause|next|…`
- No HTMLMediaElement control from commands
- No `setIndex` / renderer.next from commands
- No DB / Redis / KV command queue
- No production Admin command UI
- No changing PlaybackController public API to a second control interface

---

## Implementation plan (post-audit)

1. Pure domain: `DeviceCommand`, payloads, TTL constants, validation, serialization.
2. `mapCommandToPlaybackAction` (single file).
3. `CommandDispatcher` + bounded in-memory idempotency store.
4. `authorizeDeviceCommand` boundary (fail-closed; local harness supplies authorized context).
5. `LocalCommandTransport` for tests + DEV-ONLY Command Lab on `/player/lab`.
6. ≥50 tests; docs/ADR/evidence; full gate.
7. STOP — no RP-08 / no transport.
