# Vitrine360 — Phase 3B Content Studio Implementation

**Date:** 2026-09-22  
**Audit basis:** `docs/CONTENT-STUDIO-3B-AUDIT.md` (ARCHITECTURE AUDIT — APPROVED)  
**Scope:** Content Studio (list / create / edit) + service safety (MIME, duration, duplicate, delete, transactions)

---

## 1. Objetivo

Substituir o fluxo antigo de criação/edição inline/modal por um **Content Studio** dedicado, sem alterar Player, Runtime, Manifest, Sync, Auth, Membership, RBAC model, R2, Presentation, Transition, GIF Content Type ou Preview Renderer.

Arquitectura preservada:

```
MediaAsset → ContentAsset → Content → PlaylistItem → Playlist → Schedule / Device → Manifest → Sync → Runtime
```

A FASE 3B trabalha somente: **Media Library → Content Studio → Content + ContentAsset**.

---

## 2. Alterações

| Área | Ficheiro / rota | Mudança |
|------|-----------------|---------|
| Service | `src/services/contents.ts` | `getContent`, MIME, duration, tx create/update/duplicate, delete safety, `listContentsWithUsage` |
| API | `POST /api/admin/contents/[id]/duplicate` | Duplicação tenant-scoped |
| API | `GET/POST /api/admin/contents`, `PATCH/DELETE .../[id]` | multipart status/description; erros de domínio |
| Studio | `/admin/contents`, `/new`, `/[id]` | Lista + criação + edição |
| UI | `content-studio-form.tsx`, `media-asset-picker.tsx`, `content-list-manager.tsx` | Studio + picker + lista |
| Removido | `content-create-form.tsx` | Modal/form antigo substituído |
| Errors | `handleApiError` | mensagem PT de delete bloqueado → **409** |
| Tests | `scripts/test-content-studio-3b.ts` | CONTENT-001..027; `npm run test:content-3b` |

**Não alterado:** Player, `public/tv.js`, display-engine, Manifest, Sync, SW, IndexedDB, pairing, heartbeat, presence, Auth, Membership, ROLE_PERMISSIONS, R2 provider, schedule resolver, PlaylistItem presentation/transition.

---

## 3. Service layer

### `getContent(id, tenantId)`

Lookup tenant-scoped. Cross-tenant → `null` → API **404**.

### MIME (`assertMediaCompatibleWithType`)

| Type | Regra |
|------|-------|
| IMAGE | `mimeType.startsWith("image/")` |
| VIDEO | `mimeType.startsWith("video/")` |
| Outros | rejeita attach de MediaAsset |

Validação **só no backend**. MediaAsset de outro tenant → **404** (não revela existência).

### Duration (`assertContentDuration`)

| Type | Regra |
|------|-------|
| VIDEO | `0` = duração natural; `>0` = fixa |
| IMAGE / restantes timed | `durationMs > 0` obrigatório |

### Transactions

`db.transaction` em:

- create (Content + ContentAsset)
- update com reattach
- duplicate (Content + ContentAsset links)

Falha → rollback.

### Activity Log

| Acção | Evento |
|-------|--------|
| Create | `content.created` |
| Update | `content.updated` |
| Delete | `content.deleted` |
| Duplicate | `CONTENT_DUPLICATED` |

Convenção: eventos content legados em `content.*`; duplicate adoptou `CONTENT_DUPLICATED` (alinhado a `MEDIA_DELETED` da 3A). Uma única convenção documentada; não misturar `content.duplicated` no mesmo fluxo.

---

## 4. Content Studio

| Rota | Função |
|------|--------|
| `/admin/contents` | Lista: search, filter type/status, usage, abrir Studio, duplicar, eliminar, criar |
| `/admin/contents/new` | Criação |
| `/admin/contents/[id]` | Edição |

Campos: title, description, type (create), status ACTIVE/INACTIVE, duration, payload tipado, MediaAsset (IMAGE/VIDEO) via upload ou Media Picker tenant-scoped.

Payloads suportados (sem inventar novos): TEXT, NOTICE, EVENT, NEWS, QR_CODE, CLOCK. Sem renderer QR.

Reattach IMAGE/VIDEO: valida tenant + MIME; actualiza ContentAsset; **não** apaga MediaAsset anterior.

Deep-link Media Library → Studio: `/admin/contents/new?mediaAssetId=…`.

---

## 5. MIME validation

Backend obrigatório em create, update (reattach) e attach via `mediaAssetId`. Incompatibilidade → erro de domínio. Frontend não é fonte de verdade.

---

## 6. Duration rules

Bug do edit antigo (`min="1000"` / rejeitar `0` em VIDEO) removido com o Studio.

- VIDEO `durationMs = 0` → natural (UI sem `min` forçado)
- VIDEO `> 0` → fixed
- IMAGE `> 0` → fixed

Player / Runtime / `effectiveDuration = durationOverrideMs ?? content.durationMs` **não alterados**.

---

## 7. Duplicate

`POST /api/admin/contents/:id/duplicate` → `duplicateContent`.

Copia: type, title (`"${title} — Cópia"`), description, status, payload, durationMs, validFrom/To, ContentAsset → **mesmos** MediaAsset IDs.

Não copia: PlaylistItems, Schedules, Devices, Groups, ficheiros físicos.

Mesmo tenant. Activity: `CONTENT_DUPLICATED`.

---

## 8. Delete safety

Antes de eliminar:

1. `playlist_items.contentId`
2. `schedules.contentId`

Qualquer referência → erro PT:

> Este conteúdo está associado a uma ou mais playlists ou agendamentos e não pode ser eliminado.

HTTP **409 Conflict**. Sem `force=true`. MediaAssets **nunca** eliminados automaticamente.

---

## 9. Transactions

Create / update+reattach / duplicate usam transacção. CONTENT-025 cobre rollback quando attach inválido falha dentro do fluxo transaccional.

---

## 10. RBAC

Permissão única: `manage_contents`.

| Role | Conteúdos |
|------|-----------|
| VIEWER / OPERATOR | DENIED (403) |
| EDITOR / ADMIN / SUPER_ADMIN | ALLOWED |

Autorização nas Route Handlers via `requireSession("manage_contents")`. `tenantId` só da sessão.

---

## 11. Tenant isolation

| Caso | Resultado |
|------|-----------|
| Tenant A → Content A | OK |
| Tenant A → Content/Media B | 404 / rejeitado |
| Media Picker | só assets do tenant da sessão |
| Duplicate / delete / edit cross-tenant | 404 |

---

## 12. Activity Log

Ver secção 3. Logs visíveis em `/admin/logs` para create/update/delete/duplicate.

---

## 13. Testes

`npm run test:content-3b` — CONTENT-001..027:

Create IMAGE/VIDEO, VIDEO duration 0 e >0, IMAGE duration inválida, edit, reattach, foreign tenant media/content, duplicate (+ MediaAsset reuse, new id, sem PlaylistItem/Schedule), delete unused / playlist / schedule blocked, VIEWER denied create/edit/duplicate/delete, cross-tenant, activity, transaction rollback, ContentPicker/MediaPicker isolation.

Incluído em `npm test`.

---

## 14. Produção

| Gate | Status |
|------|--------|
| `npm run test:content-3b` | PASS |
| `npm test` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (rotas Studio + duplicate) |
| `npm run lint` | WARNINGS preexistentes; **2 errors** em `player-app.tsx` (fora de escopo 3B — ver Known limitations) |
| Production deploy | YES |
| Production smoke | PASS (ver §16) |

---

## 15. Known limitations

1. **Preview Renderer completo / QR render** — fora de escopo; payloads QR editáveis sem preview visual.
2. **GIF Content Type / Experience Runtime** — Phase 3C+.
3. **Presentation / transition / durationOverrideMs** — continuam em PlaylistItem; Studio não as edita.
4. **ESLint player-app.tsx** — 2 errors `react-hooks/refs` preexistentes no Player; **não corrigidos** (escopo absoluto proíbe alterar Player). Lint do projecto não está limpo de errors por causa disso — **GAP preexistente, não introduzido pela 3B**.
5. **Convenção Activity** — mix `content.*` legado + `CONTENT_DUPLICATED` / `MEDIA_DELETED`; normalização total diferida.
6. **Lista client-side** — filtros em memória no tenant; OK para escala actual.
7. **Multipart POST** — upload de ficheiro novo; attach de Media Library usa JSON body (`mediaAssetId`). Comportamento intencional e coberto pelo Studio.

---

## 16. Validation Status

| Gate | Status |
|------|--------|
| **IMPLEMENTED** | YES |
| **SOFTWARE VALIDATED** | YES (`typecheck` + `npm test` + `build`) |
| **PRODUCTION DEPLOYED** | YES |
| **PRODUCTION VALIDATED** | YES |

### Production deployment

| Field | Value |
|-------|--------|
| URL | https://vitrine360-psi.vercel.app |
| Deployment | `dpl_7cHqjYHAcw8t9ja8j7ybLY6JqMAR` |
| Alias | https://vitrine360-psi.vercel.app |
| Inspect | https://vercel.com/egaslemos-5751s-projects/vitrine360/7cHqjYHAcw8t9ja8j7ybLY6JqMAR |
| Ready | 2026-09-21 / 2026-09-22 |

### PRODUCTION VALIDATION

| Test | Result |
|------|--------|
| Content Studio list `/admin/contents` | **PASS** — search, type, status, usage, Novo / Abrir / Duplicar / Eliminar |
| `/admin/contents/new` | **PASS** — Studio create UI |
| `/admin/contents/[id]` | **PASS** — edit Studio; VIDEO natural checkbox |
| Create IMAGE | **PASS** — Media Library picker → `smoke-promo.png` → id `776c183d-…` |
| Create VIDEO duration 0 | **PASS** — API + verify `durationMs: 0` |
| Create VIDEO duration > 0 | **PASS** — then edited to natural |
| Edit VIDEO + natural duration | **PASS** — UI shows «Duração natural do vídeo (durationMs = 0)» |
| Reattach MIME reject | **PASS** — PNG on VIDEO → 400 MIME error |
| Reattach valid MP4 | **PASS** — 200 |
| Duplicate | **PASS** — new Content id; Activity `CONTENT_DUPLICATED` |
| Delete unused (dup) | **PASS** — 200 |
| Delete playlist-referenced | **PASS** — **409** PT message |
| Delete schedule-referenced | **PASS** — **409** PT message |
| MIME IMAGE←video | **PASS** — 400 |
| IMAGE duration 0 | **PASS** — 400 |
| Foreign content / media | **PASS** — 404 |
| VIEWER RBAC | **PASS** — list/create/patch/duplicate/delete → **403** |
| Media / Player / Devices pages | **PASS** — 200 (regressão superficial) |
| Activity Log | **PASS** — `CONTENT_DUPLICATED` + `content.created` em `/admin/logs` |

```
PHASE 3B STATUS:
PRODUCTION VALIDATED
```

Smoke artefacts: temporary VIEWER `smoke-viewer-3b-*`, playlist `3B smoke playlist`, schedule `3B smoke schedule *`, e contents `3B Prod *` criados no workspace de produção durante a validação; seguros para limpar pelo operador.
