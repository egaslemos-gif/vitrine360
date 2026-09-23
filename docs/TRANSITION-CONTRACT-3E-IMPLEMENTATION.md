# Vitrine360 — Phase 3E Transition Contract Implementation

**Date:** 2026-09-22  
**Audit:** `docs/TRANSITION-CONTRACT-3E-AUDIT.md` (APPROVED)  
**Scope:** Canonical PlaylistItem.transition contract only

---

## 1. Objectivo

Unificar o contrato de transitions em:

```ts
"fade" | "slide-left" | "zoom" | "cut"
```

Retirar `slide` (unwired). Validar nas escritas. Normalizar nas leituras. Ligar Legacy `transitionClass` a `renderSlide`.

---

## 2. Alterações

| Área | Mudança |
|------|---------|
| Domain | `TRANSITIONS`, `isTransition`, `parseTransition`, `assertTransition` |
| Service | Zod `transitionSchema` / `updatePlaylistItemSchema`; assert on add; partial patch on update |
| Manifest | `parseTransition(item.transition)` |
| Playlist UI | options via `TRANSITIONS.map` |
| Legacy `tv.js` | `transitionClass(item.transition)` em IMAGE + text card |
| Docs | `docs/architecture/02-schema.md` |
| Tests | `npm run test:transition-3e` |

**Não alterado:** Content, Media, Auth, Sync, SW, IndexedDB, fitMode semantics, Content Preview, player-app refs lint.

---

## 3. Write vs Read

| Path | Behaviour |
|------|-----------|
| Write (add/update) | **Reject** unknown (incl. `slide`) — PT error / Zod |
| Read (getPlaylist / Manifest) | **Coerce** unknown → `fade` |
| Default create | `fade` |

---

## 4. React behaviour (unchanged orchestration)

- CSS: `.player-slide-{token}`
- DisplayEngine keeps opacity crossfade; `"cut"` / VIDEO skip opacity hide
- Decision: CSS animation + existing opacity orchestration coexist (documented debt, not rewritten)

---

## 5. Legacy

- `transitionClass` agora usado em `renderSlide` (IMAGE + text-like)
- VIDEO / CLOCK: sem mudança de plano de vídeo
- Smart TV (`player-smarttv.js`): ainda hardcoded `fade-in` — **known limitation**

---

## 6. Tests

TRANS-001..010 via `scripts/test-transition-3e.ts`.

---

## 7. Validation Status

| Gate | Status |
|------|--------|
| **IMPLEMENTED** | YES |
| **SOFTWARE VALIDATED** | YES (`npm test`, typecheck, build; lint 3E files 0 errors) |
| **PRODUCTION DEPLOYED** | YES |
| **PRODUCTION VALIDATED** | YES (deploy READY; contract live; suite PASS) |

### Production

| Field | Value |
|-------|--------|
| URL | https://vitrine360-psi.vercel.app |
| Deployment | `dpl_xiuo3kEtc8p9yExJL8rJGeMdjQJy` |
| Inspect | https://vercel.com/egaslemos-5751s-projects/vitrine360/xiuo3kEtc8p9yExJL8rJGeMdjQJy |

```
PHASE 3E-B STATUS:
PRODUCTION VALIDATED
```

### Known limitations

- Smart TV (`player-smarttv.js`) still hardcodes `fade-in` (not wired)
- React DisplayEngine still combines CSS class + inline opacity orchestration
- Preexisting `player-app.tsx` ESLint refs errors unchanged
