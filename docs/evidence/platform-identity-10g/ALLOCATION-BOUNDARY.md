# ALLOCATION-BOUNDARY — PI-10G

## DEVICE_ALLOCATION

An operation is an allocation iff it increases `devices.count` under `PAIRED_NON_DISABLED`.

### Present in codebase

1. **`pairDevice`** — PENDING unpaired → ACTIVE with `tenant_id` (primary allocation).
2. **`setDeviceStatus(..., ACTIVE)` from DISABLED** — reactivation / enable (no separate `enableDevice` / `reactivateDevice` endpoint).

### NOT PRESENT

- Dedicated `enableDevice()` / `reactivateDevice()` APIs — **NOT PRESENT**; covered by `setDeviceStatus`.

### Non-allocation (no quota check)

- `startDevicePairing` (no final tenant)
- Disable, delete
- Heartbeat, offline presence, playback, sync, diagnostics
