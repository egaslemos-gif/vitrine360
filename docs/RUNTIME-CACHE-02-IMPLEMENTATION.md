# Vitrine360 — RUNTIME-CACHE-02 Persistent Media Cache & Idempotent Sync

**Date:** 2026-09-22  
**Audit:** `docs/RUNTIME-CACHE-01-AUDIT.md`  
**Status:** IMPLEMENTATION COMPLETE

---

## 1. Objectivo

Preservar a arquitectura actual e fechar os gaps do audit para que um Device já sincronizado:

1. não re-descarregue assets locais (checksum match);
2. arranque a partir de identity + manifest + blobs locais;
3. mantenha o último Manifest válido offline / em falha de sync;
4. descarregue só assets novos ou com checksum diferente;
5. nunca promova CURRENT enquanto NEXT estiver incompleto;
6. não limpe cache em boot normal;
7. no Smart TV, prefira cache local em background sem bloquear Sraf;
8. mantenha polling idempotente (`upToDate` = idle).

Modelo preservado:

```text
Device Identity (LS)
      ↓
Local Active Manifest (IDB CURRENT)
      ↓
Local Asset Cache (IDB blobs)
      ↓
Playback
      ↓
Background Sync (NEXT → activate)
```

---

## 2. Alterações

| Área | Mudança |
|------|---------|
| `player/sync/atomic.ts` | `assetsRequiringDownload`, `diffChangedAssetIds` |
| `player/sync/engine.ts` | `upToDate` idle (sem asset walk); `prepareNextManifest` → download missing → `activateNextManifest`; falha mantém CURRENT |
| `player/cache/indexed-db.ts` | Activate com verificação de checksum; `getConfig` repara LS a partir de IDB (non-fragile) |
| `player/playback/display-engine.tsx` | Bearer fallback persiste `putAssetBlob` |
| `features/player/player-app.tsx` | Remove sync duplicado em t=0; soft-timeout 15s sem abandonar sync atómico |
| `public/tv.js` (+ cache bust `v=042`) | `prepareItems` em background após `applyPlaylist` (boot + sync) |
| `services/manifest.ts` | `changedAssetIds` unique candidates (idempotência real no cliente via `hasAsset`) |
| Tests | `npm run test:runtime-cache-02` |

**Schema / Auth / SW media Cache API:** sem alteração.

---

## 3. Comportamento Sync

```text
runSyncCycle():
  current = CURRENT
  delta = GET /sync?version=N
  if !delta → keep CURRENT
  if upToDate → return CURRENT   // zero media HTTP / zero IDB walk
  prepare NEXT
  download assetsRequiringDownload(all required)  // hasAsset gate
  activateNextManifest()  // throws if incomplete → clear NEXT, keep CURRENT
  GC stale blobs
```

---

## 4. Smart TV policy

- Playback imediato com URLs remotas (evita freeze Sraf).
- `prepareItems` corre em background e actualiza `playState.items` com blob/cache URLs.
- Fingerprint ignora URL → não reinicia o slideshow quando o cache fica pronto.

---

## 5. Testes

```bash
npm run test:runtime-cache-02
```

Cobre: activation gate, skip present checksums, checksum change, true delta helper, warm-cache zero downloads, incomplete must not activate.

---

## 6. Validação manual

1. Pairing → sync completo → refresh: playback local antes do sync.  
2. DevTools Network: poll `upToDate` sem `/api/device/media`.  
3. Offline: continua último CURRENT.  
4. Alterar um media (checksum): só esse asset descarrega.  
5. Hisense/`tv.html?v=042`: slideshow arranca; após cache, slides usam URLs locais quando disponíveis.

---

## 7. Status

```
PHASE RUNTIME-CACHE-02 — IMPLEMENTATION COMPLETE
SOFTWARE GATE — READY FOR PRODUCTION VALIDATION
```
