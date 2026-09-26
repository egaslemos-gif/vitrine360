# RUNTIME-PLAYBACK-07 — Device Command Model & Command Dispatch Foundation

Date: 2026-09-26

## Principle

```
COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION
```

| Layer | Role |
|-------|------|
| DeviceCommand | Intention addressed to a Device |
| Transport | Future delivery (not in RP-07) |
| PlaybackAction | Internal controller action |
| PlaybackController | Sole authority for PlaybackState |

Flow: Command → Validation → Authorization → Admission → Dispatch → PlaybackAction → PlaybackController.

Never: Network → HTMLMediaElement / setIndex / renderer.next().

## Command schema

```ts
type DeviceCommand = {
  commandId: string
  tenantId: string
  deviceId: string
  sessionId?: string
  type: DeviceCommandType
  payload: DeviceCommandPayload
  issuedAt: number
  expiresAt: number
  correlationId?: string
  binding: "DEVICE_BOUND" | "SESSION_BOUND"
}
```

- `commandId`: unique, non-guessable (`cmd_` + UUID); stable across retries.
- Serialization: JSON-safe plain object; `MAX_COMMAND_BYTES = 8KB`.
- No credentials (Bearer, JWT, R2, tenant secrets) inside Command.

## Command types & payloads

| Type | Payload |
|------|---------|
| PLAY / PAUSE / STOP / NEXT / PREVIOUS / RESTART | `{}` |
| SEEK | `{ positionMs ≥ 0, finite }` |
| SET_VOLUME | `{ volume ∈ [0,1] }` |
| SET_MUTED | `{ muted: boolean }` only |
| SET_REPEAT_MODE | `{ repeatMode: NONE \| PLAYLIST \| ITEM }` |

No SHUFFLE / PLAY_ITEM. No `Record<string, unknown>` as authority.

## Target & binding

- Always targeted at a concrete `deviceId` (no `*`).
- `tenantId` must match device tenant (fail-closed).
- Playback commands in RP-07 prefer **SESSION_BOUND**: `sessionId` must equal active PlayerSession or → `STALE_SESSION`.
- DEVICE_BOUND reserved for future non-session commands.

## TTL

| Bound | Value |
|-------|-------|
| MIN | 1s |
| DEFAULT | 10s |
| MAX | 60s |

No infinite TTL. `now >= expiresAt` → `EXPIRED` (fail-closed). Clock authority is the environment that creates the command; client time is not a security authority (documented limitation until server transport).

## Idempotency & replay

- Same `commandId` → first `APPLIED`, retries `DUPLICATE` (no second PlaybackAction).
- Bounded in-memory store with record expiry — **not durable / not distributed**.
- Replay protection: commandId + expiresAt + session binding.

## Ordering

Local only: `issuedAt` + `commandId`. No distributed ordering. Incompatible state → controller validation. No coalescing in RP-07.

## Authorization boundary

`authorizeDeviceCommand(command, ctx)`:

- Require `ctx.authorized`
- Tenant match (command ↔ issuer ↔ device)
- Device match / operable (not DISABLED/PENDING)
- Permission: existing `manage_devices` (no new REMOTE_CONTROL_ADMIN / entitlement)

ONLINE ≠ commandable. Presence remains observation.

## Dispatcher

`CommandDispatcher`: validate → expiry → target → session → auth → `mapCommandToPlaybackAction` → `PlaybackController.dispatch` → `CommandResult`.

Must not import HTMLMediaElement / renderer / touch media.

## ACK

```ts
type CommandResult = {
  commandId, status, deviceId, sessionId, action, appliedAt?, reason?, correlationId?
}
```

Statuses: APPLIED | REJECTED | EXPIRED | DUPLICATE | STALE_SESSION.

**APPLIED** = accepted at dispatch/controller boundary — not visual media confirmation. PlaybackState remains SoT; future correlation with PlaybackObservation via `commandId` / `correlationId`.

Safe reject reasons only (no stacks / secrets).

## Local harness

- `LocalCommandTransport` — in-process, no network.
- DEV-only Command Lab on `/player/lab` (production lab remains disabled).
- No Admin Console / production remote APIs.

## Future transport boundary

RP-07 stops at local dispatch. SSE / WebSocket / brokers / remote `POST /api/device/*` are out of scope.

## Code map

| Concern | Path |
|---------|------|
| Domain | `src/domain/device-command.ts` |
| Mapping | `src/domain/command-mapping.ts` |
| Authz | `src/domain/command-authorize.ts` |
| Dispatcher | `src/player/command/command-dispatcher.ts` |
| Idempotency | `src/player/command/idempotency-store.ts` |
| Local transport | `src/player/command/local-command-transport.ts` |
| Command Lab | `src/player/command/command-lab-panel.tsx` |
| Tests | `npm run test:runtime-playback-07` |
