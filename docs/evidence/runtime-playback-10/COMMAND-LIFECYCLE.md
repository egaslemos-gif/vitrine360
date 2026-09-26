# COMMAND-LIFECYCLE

The command lifecycle for Vitrine360 Remote Control is explicitly separated into independent phases to avoid claiming causal relationships without physical proof.

## Lifecycle States

1. **CREATED / QUEUED**
   - The user requests an action (e.g., `NEXT`).
   - The request is written to `device_command_inbox` with status `QUEUED`.
   - UI shows: "A aguardar dispositivo".
   - *This does not imply the device is offline; it implies the device has not polled yet.*

2. **DELIVERED**
   - The device polls the endpoint (`POST /api/device/commands`) and claims the command.
   - Database is updated to `DELIVERED`, and a `leaseUntil` is set.
   - UI shows: "Entregue ao dispositivo".
   - *This means the device has network connectivity and received the payload.*

3. **DISPATCHED**
   - The payload reaches the Player on the device (`CommandPoller`).
   - `CommandDispatcher` processes the intent.
   - This phase is typically synchronous on the client and is not tracked as a distinct durable state.

4. **APPLIED (Terminal)**
   - The `PlaybackController` accepts the dispatch.
   - The device sends an `ACK` (`POST /api/device/commands/:id/ack`) with `status = APPLIED`.
   - UI shows: "Comando aplicado".
   - *This does NOT mean the visual state changed. It only means the state machine accepted the transition.*

5. **REJECTED (Terminal)**
   - The device refused to apply the command (e.g., `INVALID_COMMAND`).
   - UI shows: "Comando recusado".

6. **EXPIRED (Terminal)**
   - The TTL was reached before the command could be delivered or applied.
   - UI shows: "Comando expirado".

7. **DUPLICATE (Terminal)**
   - The device already processed this `commandId`. (Used for idempotency).
   - UI shows: "Comando já processado".

8. **STALE_SESSION (Terminal)**
   - The command was bound to Session A, but the player is currently on Session B.
   - UI shows: "Recusado: sessão mudou".
