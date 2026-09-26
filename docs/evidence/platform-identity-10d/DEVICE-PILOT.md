# DEVICE-PILOT — PI-10D

## Chosen boundary

Admin device “creation” for a tenant is **`pairDevice`** (`src/services/devices.ts`), called from `POST /api/admin/devices` after `requireSession("manage_devices")`.

## Not gated in this phase

| Path | Why |
|------|-----|
| `startDevicePairing` | Creates PENDING device with `tenantId=null` (TV bootstrap) |
| Device Bearer routes | Out of scope; Bearer does not grant entitlement |
| Media / Content / Experience / Player | Explicitly excluded |

## Gate

`assertDevicesEnabled(tenantId, "device.pair")` → `devices.enabled` FEATURE_GATE.

On DENY: activity log `entitlement.denied` + `EntitlementDeniedError` → HTTP 403.
