# Vitrine360 — SCHED-02 Schedule Execution Implementation

**Date:** 2026-09-22  
**Audit:** `docs/SCHEDULE-EXECUTION-SCHED-01-AUDIT.md`  
**Status:** IMPLEMENTATION COMPLETE

---

## 1. Objectivo

Corrigir RC-1 (Sync version gate / wall-clock) e RC-2 (HH:mm vs HH:mm:ss) para que Schedules alterem o playback efectivo nos Devices.

Modelo preservado:

```text
Schedule + targets
  → resolveEffectivePlayback()
  → buildDeviceManifest()
  → Sync delta
  → Player playlist
```

`devices.currentPlaylistId` continua a ser a atribuição **DEFAULT** manual — Schedules **não** a sobrescrevem.

---

## 2. Alterações

| Área | Mudança |
|------|---------|
| `domain/schedule-time.ts` | Normalize `HH:mm(:ss)` → minutos; janela inclusiva; overnight |
| `domain/playback-resolver.ts` | Usa `isWithinDailyWindow` (já não compara strings cruas) |
| `domain/effective-playback-key.ts` | Fingerprint `source\|playlist\|schedule\|emergency\|priority` |
| `db/schema` + `ensureSchema` | Coluna `devices.effective_playback_key` |
| `services/schedules.ts` | Normalize times no Zod; EMERGENCY exige `contentId`; `bumpManifestForScheduleTargets` em create / activate / delete; `deleteSchedule` |
| `services/manifest.ts` | `buildSyncDelta`: re-resolve; se key mudou → bump version + publicar; `effectivePlayback` no manifest |
| `schedule-form.tsx` | Horas `HH:mm`; erros HTTP; sem EMERGENCY na UI; copy operacional |
| Tests | `npm run test:sched-02` |

**Player / tv.js:** sem alteração obrigatória — Sync devolve manifest quando a key muda; fingerprint do Legacy evita restart se a playlist for igual.

---

## 3. Comportamento Sync (Option A)

```text
buildSyncDelta(device, clientVersion):
  resolve effective → key
  versionStale = clientVersion < manifestVersion
  playbackStale = device.effectivePlaybackKey !== key
  if !versionStale && !playbackStale → upToDate
  else → build manifest, persist key (+ bump se playbackStale)
```

Assim:

- Criar Schedule → bump targets → Sync na próxima ronda  
- Entrar/sair da janela horária → key muda sem cron → Sync publica  

---

## 4. Testes

```bash
npm run test:sched-02
```

Cobre normalize, fora/dentro da janela, bump de versão, sync após create, wall-clock refresh, prioridade HIGH > NORMAL.

---

## 5. Operador

1. Criar Schedule (playlist + target + horas diárias + dias).  
2. Devices **não** mostram mudança em “playlist atribuída”.  
3. Abrir Player (`/tv.html`) — em ≤ ~60s deve entrar a playlist do Schedule.  
4. Fora da janela — volta ao DEFAULT na sync seguinte.

---

## 7. SCHED-02B — Management UI (edit / activate / delete)

| Capacidade | Implementação |
|------------|---------------|
| Lista com acções | `schedule-list-manager.tsx` |
| Activar / Desactivar | `PATCH /api/admin/schedules/[id]` `{ active }` → `setScheduleActive` |
| Editar | Dialog → `updateSchedule` (targets + bump old/new) |
| Eliminar | Confirm → `DELETE /api/admin/schedules/[id]` |
| Targets legíveis | Nomes de Grupo / Ecrã (não só UUID) |

EMERGENCY: edição bloqueada na UI (API com `contentId` mantém-se).

---

## 8. Status

```
PHASE SCHED-02 + SCHED-02B — IMPLEMENTATION COMPLETE
SOFTWARE GATE — READY FOR PRODUCTION VALIDATION
```
