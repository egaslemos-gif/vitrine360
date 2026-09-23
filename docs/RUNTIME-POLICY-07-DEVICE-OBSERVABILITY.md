# Vitrine360 — RUNTIME-POLICY-07 Device Runtime Observability

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** POLICY-01 … 06  

---

## 1. Objectivo

Expor operacionalmente o que o Vitrine360 **sabe** sobre cada Ecrã (presença, policy, último runtime reportado, diagnostics) — sem controlar fullscreen/orientation/interaction.

## 2. Arquitectura

```
Heartbeat playerState JSON
        ↓
deriveDeviceRuntimeObservability()   ← derived, not a new SSoT
        ↓
Admin presence API (agregado) + Device detail
```

Três dimensões separadas: **Presence** · **Policy** · **Runtime / Actual**.

## 3–7. Presence / Runtime / Policy / Actual / Diagnostics

- Presence: `ONLINE` / `AWAY` (UI: INSTÁVEL) / `OFFLINE` via `derivePresence`
- Runtime: PLAYING/IDLE, sync, network (browser), content, manifest
- Policy: source + requested + resolved
- Actual: fullscreenActive, orientationActual, cursorVisible
- Diagnostics: ERROR → WARNING → INFO (sem health score)

OFFLINE + last `isPlaying=true` → **último estado reportado** (`isLastReported`).

## 8–10. Stale / Heartbeat / APIs

- `observedAt` + `stale` / `staleAgeMs`
- Heartbeat opcional: `policy`, `diagnostics`, `observedAt` (backward-compatible)
- `GET /api/admin/devices/presence` — mapa agregado (sem N+1)
- `GET /api/admin/devices/[id]` — detalhe + observability (tenant-scoped)

## 11–13. Security / UI / Performance

- Tenant session authority; 404 cross-tenant
- `assertNoAuthTokenExposure`
- Lista: poll único no `DeviceListManager`
- Detalhe: `/admin/devices/[id]`
- Compact cards + painel completo; stack em viewport estreito

## 14–17. Testes / E2E / Limitações

- `npm run test:runtime-policy-07` — OBS-001…020  
- `npm run test:device-observability-live`  
- Evidence: `docs/evidence/runtime-policy-07/DEVICE-OBSERVABILITY-E2E-RESULTS.md`

**Adiado:** SSE/WebSocket, DeviceRuntimeConfig table, Fullscreen/Orientation control, Interactive Runtime, validação física Hisense.
