# Vitrine360 — RUNTIME-POLICY-06 Runtime State & Diagnostics

**Date:** 2026-09-22  
**Status:** IMPLEMENTATION VALIDATED (software)  
**Depends on:** POLICY-01 … 05  

---

## 1. Objectivo

Observabilidade explícita do Runtime: **Requested → Resolved → Actual**, sem novas capacidades de browser (sem Fullscreen API / Orientation Lock / Interactive Runtime).

## 2. Arquitectura

```
Device config → DomainRuntimePolicy (requested)
             → capabilities + resolve → ResolvedRuntimePolicy
             → RuntimeState (actual, ephemeral)
```

Resolved ≠ Actual. Divergências geram diagnostics INFO/WARNING.

## 3. RuntimeState contract

SSoT: `src/player/runtime/state.ts` (`getRuntimeStateStore`).

Campos: `isPlaying`, `currentContentId`, `currentManifestVersion`, `syncState` (IDLE|SYNCING|READY|ERROR), `networkState` (ONLINE|OFFLINE|UNKNOWN), `cursorVisible`, `fullscreenActive`, `orientationActual`, `lastInputAt`, `lastInputClass`, `updatedAt`.

## 4. Requested vs Resolved vs Actual

Snapshot: `buildRuntimePolicyRuntimeSnapshot` / `window.__v360_runtime_state`.

Códigos: `PRESENTATION_NOT_ACTUALLY_FULLSCREEN`, `ORIENTATION_MISMATCH`.

## 5–11. Integrações

| Área | Como |
|------|------|
| Playback | `player-app` observa items / content (não altera lógica) |
| Sync | `runSyncCycle` → SYNCING / READY / ERROR |
| Network | `online` / `offline` listeners |
| Input / Cursor | hooks no `CursorIdleController` (sem 2º timer) |
| Fullscreen | só `document.fullscreenElement` |
| Orientation | Prefer viewport aspect for Player actual; fallback `screen.orientation` — never `lock()` |

## 12. Heartbeat

Campo opcional `runtimeState` no POST (backward-compatible). Persistido dentro de `player_state` JSON. **Não** usado para autorização.

## 13–14. Diagnostics & Security

Globals: `__v360_runtime_capabilities`, `__v360_runtime_policy`, `__v360_runtime_state`.  
`assertNoAuthTokenExposure` / tenant-device scope. Admin: secção compacta em `LivePresence`.

## 15–16. Testes & E2E

- `npm run test:runtime-policy-06` — RUNTIME-STATE-001…020  
- `npm run test:runtime-state-live` — Scenarios A–F  
- Evidence: `docs/evidence/runtime-policy-06/RUNTIME-STATE-E2E-RESULTS.md`

## 17–18. Limitações / adiados

- Observacional apenas — sem `requestFullscreen` / `orientation.lock`
- Interactive Runtime / HTML_APP / Experience Package não existem
- Legacy `tv.js` não plenamente integrado
- Hisense físico não validado nesta fase
- Browser ONLINE ≠ backend acessível
- PWA `display:fullscreen` ≠ Fullscreen API
- Runtime State ≠ autorização
