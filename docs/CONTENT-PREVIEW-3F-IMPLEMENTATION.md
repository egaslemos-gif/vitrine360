# Vitrine360 — Phase 3F Content Preview Implementation

**Date:** 2026-09-22  
**Audit basis:** `docs/CONTENT-PREVIEW-3F-AUDIT.md` (APPROVED)  
**Scope:** Admin Content Preview in Content Studio only

---

## 1. Objectivo

Permitir pré-visualizar o **Content lógico** no Content Studio (`/admin/contents/[id]`), sem Playlist, Device, Manifest, Sync ou Player.

```
Content → getContentForPreview → ContentVisual → PreviewHost → Content Studio
```

---

## 2. Arquitectura

| Camada | Módulo |
|--------|--------|
| Model | `ContentPreviewModel` / `ContentPreviewRow` |
| Service | `getContentForPreview(id, tenantId)` |
| Visual | `src/features/contents/content-visual.tsx` |
| Host | `src/features/contents/preview-host.tsx` |
| Types (client-safe) | `src/features/contents/content-preview-types.ts` |
| Studio | `src/app/admin/contents/[id]/page.tsx` |

**Não** importa: `player-app`, `display-engine`, IndexedDB, manifest, device media.

Playlist timed preview **não** foi migrado nesta fase (evitar regressão).

---

## 3. ContentPreviewModel

```ts
{
  id, title, type, durationMs, payload,
  mediaUrl, status, validFrom, validTo, mimeType
}
```

- Tenant-scoped; outro tenant → `null` → página **404**
- `mediaUrl` via `MediaStorageProvider.getUrl(storageKey)` (igual a `listContentsForPreview`)
- Sem `/api/device/media`

---

## 4. ContentVisual

Renderizadores por tipo (texto puro; sem `dangerouslySetInnerHTML`):

| Type | Comportamento |
|------|----------------|
| IMAGE | `<img object-contain>` + loading/erro |
| VIDEO | `<video muted playsInline controls>` + badge duração; cleanup pause/src on unmount |
| TEXT | body + align + fontSize |
| NOTICE | message |
| EVENT | description + date/time/location (só se presentes) |
| NEWS | body + source opcional |
| CLOCK | `previewNow` + showDate/showTime/format |
| QR_CODE | stub seguro (título, label, URL texto, “QR visual ainda não disponível”) |

---

## 5. PreviewHost

- Contentor `aspect-video`, fundo `#070b14`, border
- Badges ACTIVE / INACTIVE
- Aviso «Fora do período de validade» (não bloqueia)
- Sem iframe / fullscreen / PWA

---

## 6. Content types suportados

Todos os `CONTENT_TYPES` no Preview administrativo. Draft em `/new` **não** incluído (melhoria futura).

---

## 7. Video

- Streaming por `mediaUrl`
- Sem Blob URL / IndexedDB
- `durationMs === 0` → «Duração natural»
- Sem timers de playlist / advanceSlide

---

## 8. Clock

- Preview Time injectável (`previewNow`)
- Respeita payload; **não** altera Player CLOCK (technical debt)

---

## 9. QR

Stub apenas. Sem nova dependência npm.

---

## 10. Security

- Session + `manage_contents`
- Tenant isolation
- Plain text payloads
- QR URL como dado

---

## 11. RBAC

Reutiliza `manage_contents`. Sem `preview_contents`. VIEWER/OPERATOR inalterados.

---

## 12. Tenant isolation

`getContentForPreview` + page `notFound()`; testes PREVIEW-010/011.

---

## 13. Tests

`npm run test:preview-3f` — PREVIEW-001..020 (modelo, validity, isolation estática, lifecycle source).  
Incluído em `npm test`.

---

## 14. Regression

| Check | Status |
|-------|--------|
| `npm run test:preview-3f` | PASS |
| `npm run test:content-3b` / `test:media-3a` | PASS |
| `npm test` | PASS |
| `npm run typecheck` / `build` | PASS |
| lint (ficheiros 3F) | PASS (0 errors) |
| lint (repo) | 2 errors preexistentes em `player-app.tsx` apenas |

---

## 15. Production

| Field | Value |
|-------|--------|
| URL | https://vitrine360-psi.vercel.app |
| Deployment | `dpl_4MRV5ZpunwJBp1A3r9CeprLEmESL` |
| Inspect | https://vercel.com/egaslemos-5751s-projects/vitrine360/4MRV5ZpunwJBp1A3r9CeprLEmESL |
| Alias | https://vitrine360-psi.vercel.app |

### PRODUCTION VALIDATION

| Test | Result |
|------|--------|
| Deploy READY | **PASS** |
| VIEWER `/admin/contents` | **PASS** — 403 Acesso negado |
| EDITOR login + Studio | **PASS** |
| IMAGE Preview UI | **PASS** — Pré-visualização + media contain (`776c183d-…`) |
| VIDEO natural badge | **PASS** — «Duração natural» on page (`31d82d1c-…`) |
| TEXT / NOTICE / EVENT / NEWS / CLOCK / QR pages | **PASS** — Pré-visualização present; QR stub copy + URL |
| INACTIVE Preview | **PASS** — badge INACTIVE + preview |
| Foreign content | **PASS** — `/admin/contents/{uuid}` → **404** |

Smoke contents criados para TEXT/NOTICE/EVENT/NEWS/CLOCK/QR/INACTIVE podem permanecer no workspace; limpeza operacional recomendada.

---

## 16. Known limitations

1. Sem preview de draft em `/admin/contents/new`
2. QR sem matriz visual
3. PlaylistTimedPreview ainda com Slide interno (migração diferida)
4. Fidelidade CLOCK/payloads no Device Player não corrigida
5. R2 signed URL pode expirar em tabs longas — refresh via reload da página
6. Artefactos de smoke 3F no workspace prod (ver §15)

---

## 17. Technical debt (Player — não corrigido)

- `player-app.tsx` react-hooks/refs ESLint (2 errors preexistentes)
- fitMode unused no Runtime
- Payload fields ignored no Player
- QR Player missing
- CLOCK Runtime ignora payload / timezone workspace

---

## 18. Validation Status

| Gate | Status |
|------|--------|
| **IMPLEMENTED** | YES |
| **SOFTWARE VALIDATED** | YES |
| **PRODUCTION DEPLOYED** | YES |
| **PRODUCTION VALIDATED** | YES |

```
PHASE 3F-B STATUS:
PRODUCTION VALIDATED
```
