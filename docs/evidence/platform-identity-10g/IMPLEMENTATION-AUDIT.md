# IMPLEMENTATION-AUDIT — PI-10G

## Mutations affecting PAIRED_NON_DISABLED

| Mutation | Effect | Quota? |
|---|---|---|
| `startDevicePairing` | PENDING, `tenant_id=null` | No |
| `pairDevice` | PENDING→ACTIVE + tenant | **Yes (allocation)** |
| `setDeviceStatus` DISABLED→ACTIVE | increases count | **Yes (allocation)** |
| `setDeviceStatus` →DISABLED | decreases count | No (allowed under overage) |
| `deleteDevice` | removes row | No (allowed under overage) |
| Heartbeat / last_seen / OFFLINE | presence only | No |
| Player / sync / bootstrap token | no count change | No |

## Bypass audit

Enforcement lives in `src/services/devices.ts` (`pairDevice`, reactivate path of `setDeviceStatus`), not UI-only. No alternate INSERT path for paired devices found outside these services.

## Reuse

- `resolveEffectiveEntitlements()`
- `countDevices(..., PAIRED_NON_DISABLED)`
- `evaluateQuota()`
- `assertDevicesEnabled` (PI-10D) still gates pair/reactivate
