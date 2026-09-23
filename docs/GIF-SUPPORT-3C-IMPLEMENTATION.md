# Vitrine360 — Phase 3C-B GIF Support Implementation

**Date:** 2026-09-22  
**Audit basis:** `docs/GIF-SUPPORT-3C-AUDIT.md` (ARCHITECTURE AUDIT — APPROVED)  
**Scope:** Explicit GIF as IMAGE + `image/gif` — Studio UX, list/preview badges, docs, tests

---

## 1. Objectivo

Tornar o suporte GIF **explícito e consistente** sem criar Content type `GIF`.

Contrato congelado:

```text
MediaAsset.mimeType = image/gif
        ↓
Content.type = IMAGE
        ↓
PlaylistItem duration / override (timer)
        ↓
Manifest type = IMAGE · asset mime = image/gif
        ↓
Runtime <img> + timer
```

---

## 2. Alterações

| Área | Ficheiro | Mudança |
|------|----------|---------|
| Helper | `src/features/contents/gif-support.ts` | `isGifMime` re-export + `GIF_SLIDE_HINT_PT` |
| Service | `listContentsWithUsage` | `primaryMimeType` do MediaAsset primário |
| Studio | `content-studio-form.tsx` | Badge GIF + hint de duração/timer |
| Picker | `media-asset-picker.tsx` | Badge GIF nas thumbs; label “inclui GIF” |
| Lista | `content-list-manager.tsx` | Badge GIF + `image/gif` na meta |
| Preview | `preview-host.tsx`, `content-visual.tsx` | Badge / overlay GIF; footer IMAGE · GIF |
| Detail | `admin/contents/[id]/page.tsx` | Header `IMAGE · GIF` |
| Tests | `scripts/test-gif-support-3c.ts` | GIF-001…010; `npm run test:gif-3c` |

**Não alterado:** `CONTENT_TYPES`, Player, `display-engine`, `tv.js`, Manifest schema, Sync, SW, IndexedDB, Auth/RBAC, schema DB, duração natural IMAGE.

---

## 3. Política operacional (operadores)

| Regra | Valor |
|-------|-------|
| Tipo de conteúdo | Sempre **IMAGE** |
| MIME | `image/gif` |
| Duração | `durationMs > 0` (timer do slide) |
| Animação | Browser anima dentro de `<img>`; pode **repetir ou cortar** quando o timer dispara |
| Duração natural | **Não** (não confundir com VIDEO `durationMs = 0`) |
| Media Library | Filtro GIF separado (Phase 3A) |
| Content Studio | GIF aparece no picker IMAGE |

---

## 4. Testes

```bash
npm run test:gif-3c
```

| ID | Cobertura |
|----|-----------|
| GIF-001 | sniffMime + upload `image/gif` |
| GIF-002 | Media Library filter GIF vs IMAGE |
| GIF-003 | create Content IMAGE + gif MediaAsset |
| GIF-004 | reject VIDEO + gif |
| GIF-005 | IMAGE duration must be > 0 |
| GIF-006 | Preview mediaUrl + mime image/gif |
| GIF-007 | Manifest type IMAGE + asset mime gif |
| GIF-008 | Cross-tenant attach rejected |
| GIF-009 | Dedupe SHA-256 same gif bytes |
| GIF-010 | `CONTENT_TYPES` sem `GIF` |

Incluir no suite: `npm test` (já inclui `test:gif-3c`).

---

## 5. Hisense / VIDAA smoke (GIF-011 — manual)

**Não executado automaticamente nesta fase.** Software pode ser PRODUCTION VALIDATED no admin/pipeline; **device GIF VALIDATED** só após smoke.

### Checklist

1. Upload GIF pequeno na Media Library (workspace de teste).  
2. Criar Content IMAGE a partir do GIF; duração 8–10 s.  
3. Adicionar a playlist activa do dispositivo Hisense.  
4. Sync / refresh Player Legacy (`tv.js`).  
5. Observar:
   - [ ] Slide aparece como IMAGE  
   - [ ] Animação GIF corre (não só 1.º frame estático)  
   - [ ] Avança no timer (não espera loops)  
   - [ ] Offline: após cache, GIF ainda reproduz  
6. Registar resultado em `docs/HISENSE-PHYSICAL-VALIDATION.md` (secção GIF) ou anexo.

**Se Sraf mostrar só frame estático:** documentar limitação; manter política IMAGE+`<img>` (sem decoder custom).

---

## 6. Explicit non-goals (cumpridos)

- Sem Content type `GIF`  
- Sem decoder / loop-complete  
- Sem mudanças Player/Runtime  
- Sem schema migration  

---

## 7. Status

```
PHASE 3C-B — IMPLEMENTATION COMPLETE
GIF-011 admin/prep — PASS (see docs/evidence/gif-011/GIF-011-RESULTS.md)
GIF-011 Hisense physical playback — NOT OBSERVED (device offline)
DEVICE GIF VALIDATED — NOT CLAIMED
```

Após `npm run test:gif-3c` PASS e regressão relevante:

```
SOFTWARE GATE — READY FOR PRODUCTION VALIDATION
```

Hisense physical animation/timer remains **open** until operator observation on powered `TV-CASA-001`.
