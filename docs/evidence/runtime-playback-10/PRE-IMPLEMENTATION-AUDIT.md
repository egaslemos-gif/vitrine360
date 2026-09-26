# PRE-IMPLEMENTATION AUDIT

## 1. Existing Command Lifecycle

The backend command queue is implemented via `device_command_inbox` in the database (`src/db/schema.ts`).
The domain logic is in `src/services/device-commands.ts` and `src/domain/device-command.ts`.

- **CREATED/QUEUED**: Commands are created via `enqueueDeviceCommand`. The initial state in the DB is `QUEUED`. A `CommandId` is generated, and TTL/expiry is enforced.
- **DELIVERED**: Devices poll `/api/device/commands`. The handler uses `claimDeviceCommands`, which updates the state from `QUEUED` to `DELIVERED` and sets a `leaseUntil` timestamp.
- **DISPATCHED/APPLIED**: On the client side (Player), `CommandPoller` receives the command and passes it to `CommandDispatcher`. The dispatcher executes it against the `PlaybackController`.
- **ACK**: After dispatching, the `CommandPoller` sends a `CommandResult` back via `POST /api/device/commands/:commandId/ack`.
- **REJECTED / EXPIRED / DUPLICATE / STALE_SESSION**: These states are supported in `CommandResultStatus` and handled in `CommandDispatcher` and backend logic.

## 2. Existing Command Persistence

- `device_command_inbox` table stores `commandId`, `tenantId`, `deviceId`, `status`, `expiresAt`, `leaseUntil`, etc.
- Indexes exist for fast polling (`device_command_inbox_tenant_device_status_idx`).
- `CommandResult` domain type defines the structure returned by the device.

## 3. Existing ACK

- The endpoint `src/app/api/device/commands/[commandId]/ack/route.ts` receives the `CommandResult` and updates the `device_command_inbox` status.
- It uses the Device Bearer token for authorization.

## 4. Existing Playback Observation

- `PlaybackState` (the source of truth for playback) is managed by `PlaybackController`.
- `PlaybackObservation` is a projection derived from `PlaybackState` via `playbackObservationFromState()`.
- `PlayerSessionStore` receives `PlaybackState` updates and caches the current `PlaybackObservation`.

## 5. Existing Device Observability

- The heartbeat endpoint `POST /api/device/heartbeat` receives `runtimeState`.
- `runtimeState` may contain `currentContentId` and other diagnostics, which updates the `devices` table (e.g., lastSeen, status = ONLINE/OFFLINE).
- Presence (ONLINE/OFFLINE) is tracked separately from command status.

## 6. Current UI Capabilities

- The `Player Lab` (`/player/lab`) allows sending some commands.
- There is no comprehensive UI that shows the strict chronological timeline (Created -> Queued -> Delivered -> Applied -> Observed).
- The separation between "Command Applied" and "Playback Observed" is not formalized in a correlation UI.

## 7. Missing Operational State

- **Command Timeline**: We need to track and display timestamps for Created, Queued, Delivered, Dispatched, Applied, and Observed. `device_command_inbox` has `createdAt`, `deliveredAt` (possibly as `leaseUntil` start or a new column), and `updatedAt` for ACK.
- **Correlation**: `CommandObservationCorrelation` is needed to explicitly relate a `CommandResult` to a subsequent `PlaybackObservation`.
- **Latency Metrics**: The system needs to calculate `queueLatency`, `deliveryLatency`, `dispatchLatency`, `ackLatency`, and `observationLatency` based on timestamps.
- **Remote Control UI Primitives**: Reusable components (`CommandStatusBadge`, `CommandTimeline`, `CommandResultSummary`) are missing.
