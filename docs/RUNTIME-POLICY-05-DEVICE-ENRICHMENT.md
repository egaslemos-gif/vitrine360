# Vitrine360 — RUNTIME-POLICY-05 Device Runtime Policy Enrichment

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** POLICY-01 … 04  

---

## 1. Device fields

Persisted on `devices` (no new table):

| Field | Runtime Policy meaning |
|-------|------------------------|
| `displayType` | Hardware/context only — **does not** set presentation |
| `interactionMode` | → `PASSIVE` or `INTERACTIVE` policy |
| `orientation` | → `LANDSCAPE` / `PORTRAIT` / `AUTO` |
| `timezone` | Schedule/Device clock — **not** in DomainRuntimePolicy |
| `name` / `location` / `currentPlaylistId` / `status` | Ops / playback — not policy chrome |
| (no cursor / fullscreen / input columns) | Defaults: `AUTO_HIDE`, `AUTO`, `KEYBOARD_LIKE+…` |

Wire shape: `DevicePolicyConfigWire` via bootstrap claim + heartbeat `deviceConfig`.

---

## 2. Policy mapping

`defaultPolicyFromDeviceConfig()` (single function):

- `presentation` → always **AUTO** (never TV→FULLSCREEN)
- `cursor` → **AUTO_HIDE**
- `input` → default (`KEYBOARD_LIKE`, `MOUSE`, `TOUCH`)
- `interaction` → PASSIVE if `interactionMode=PASSIVE`, else INTERACTIVE
- `orientation` → from Device.orientation (normalized)

---

## 3. Defaults

Without server enrichment (`hasDevicePolicy` false): `DEFAULT_DOMAIN_RUNTIME_POLICY`  
(`policySource: DEFAULT`).

---

## 4. Policy source

| Value | When |
|-------|------|
| `DEVICE_CONFIG` | LocalConfig enriched from server Device row |
| `DEFAULT` | Unpaired / no server fields |
| `EXPLICIT` | `resolvePlayerRuntimePolicy({ policy })` override |

Emitted in diagnostics and `window.__v360_runtime_policy.policySource`.

---

## 5. React flow

1. Heartbeat / claim → `deviceConfig` → `LocalConfig` (`applyServerDeviceConfig` / `withServerDeviceConfig`)
2. `PlayerRuntimeShell` reads LocalConfig → `defaultPolicyFromDeviceConfig` / resolve
3. Re-resolves on `v360-device-config-updated`
4. `CursorIdleController(resolved.cursor)` only

No Fullscreen API / orientation.lock / Interactive Runtime.

---

## 6. Legacy strategy

Domain remains the only resolver. Legacy (`tv.js`) not fully wired this phase — documented deferral; no duplicate algorithm.

---

## 7. Tenant isolation

`assertTenantDeviceScope` on resolve.  
`applyServerDeviceConfig` / `withServerDeviceConfig` reject cross-`deviceId` / cross-`tenantId` merges.

---

## 8. Tests

`npm run test:runtime-policy-05` — DEVICE-POLICY-001…013.

## 9. E2E

`npm run test:device-policy-live` — Scenarios A/B/C.  
Evidence: `docs/evidence/runtime-policy-05/DEVICE-POLICY-E2E-RESULTS.md`

## 10. Limitations

- Local unpaired devices stay on DEFAULT until claim/heartbeat enrichment
- Presentation AUTO may still resolve to FULLSCREEN/WINDOWED via capability (desired chrome vs API call)
- Legacy not consuming Device policy yet
- No DeviceRuntimeConfig table / no new fullscreen|cursor|input columns
