# FINAL-VALIDATION — AUTHZ-DEVICE-02B

## Veredicto: **VALIDATION PENDING**

Tudo o que é específico de AUTHZ-DEVICE-02 está validado. Falha **um** critério literal: `npm run lint` não é PASS.
Não é declarado VALIDATED, conforme a regra da spec.

## Checklist

| Critério | Estado | Evidência |
|---|---|---|
| handleApiError testado por categoria | ✅ | `src/lib/api.test.ts` |
| PairDeviceForm testado end-to-end | ✅ | browser 71/71 |
| PERMISSION_DENIED correcto | ✅ | real (caso reportado) + mock |
| ENTITLEMENT_DENIED correcto | ✅ | real (`devices.enabled=false`) + mock |
| QUOTA_EXCEEDED correcto | ✅ | real (uso ≥ máx) + mock |
| Activation error correcto | ✅ | real + mock |
| Already registered correcto | ✅ | real (400) + mock 409 |
| Success correcto | ✅ | real; lista actualizada |
| Duplicate submission bloqueada | ✅ | 6 disparos → 1 request |
| Form preservation | ✅ | 4/4 campos em erro; só o código é limpo em sucesso |
| VIEWER / EDITOR / OPERATOR / ADMIN / SUPER_ADMIN | ✅ | matriz 15/15 (ROLE-VALIDATION) |
| Consumers de api.ts auditados | ✅ | API-CONSUMER-COMPATIBILITY.md |
| `npm test` | ✅ PASS | exit 0 (inclui `test:authz-device-02`, 93 testes) |
| `npm run typecheck` | ✅ PASS | |
| `npm run build` | ✅ PASS | |
| Browser E2E | ✅ PASS | 71/71, Chromium |
| **`npm run lint`** | ❌ **não PASS** | 116 problemas, **6 erros**, 110 warnings |

## Lint — o bloqueio
- Os 6 erros são **anteriores** a esta tarefa (a baseline pré-existente está preservada em `docs/evidence/release-hygiene-01/POST-CLEANUP.md`) e estão fora de AUTHZ-DEVICE-02:
  - `scripts/dump.ts:29` — `no-require-imports`.
  - `src/player/playback/playback-renderer-adapter.tsx:123-127` — 5× `react-hooks/refs` (MEDIA-RUNTIME-01; fora do âmbito, e o adapter está protegido por regra).
- Ficheiros desta tarefa (`api.ts`, `api.test.ts`, `api-error-mapping.ts`, `pair-device-form.tsx`, scripts authz02): **0 problemas** com `eslint` dirigido.
- Decisão necessária: aceitar "sem novos erros" como critério, ou corrigir os 6 erros noutra tarefa.

## Alterações feitas nesta validação (mínimas, para preservar comportamento)
1. `src/lib/api.ts`: `error` volta a conter o texto legado nas categorias que não são de autorização (Zod, validação, not found, conflito, membership, tenant, interno); `code` estruturado em todas. Repara o fallback de `direct-upload.ts` e as mensagens de vários formulários.
2. `src/lib/api-error-mapping.ts`: lê `code` primeiro; `UNAUTHENTICATED` → `AUTHENTICATION_REQUIRED`.
3. `pair-device-form.tsx`: guard síncrono `useRef` contra duplo submit; sucesso limpa apenas o código de activação (UX original); `min-w-0` + `overflow-wrap:anywhere` (overflow).
4. `scripts/test-platform-identity-10g.ts` e `10j.ts`: asserção de `PI10G-ERROR`/`PI10J-ERROR` actualizada para `error:"QUOTA_EXCEEDED"` (mudança de contrato pretendida).
5. `package.json`: `test:authz-device-02`, incluído em `npm test` (os `*.test.ts` de AUTHZ-02 não corriam antes em nenhum script).
6. Novos: `src/lib/api.test.ts`, `scripts/authz02-e2e-seed.ts`, `scripts/authz02-e2e-browser.ts`.

Não foram alterados roles, permissions, entitlements nem quotas.

## Como reproduzir
```
DATABASE_URL=file:./data/authz02-e2e.db npx drizzle-kit push --force
DATABASE_URL=file:./data/authz02-e2e.db npx tsx scripts/authz02-e2e-seed.ts
DATABASE_URL=file:./data/authz02-e2e.db ENTITLEMENTS_ENABLED=true npx next start -p 3120
DATABASE_URL=file:./data/authz02-e2e.db BASE_URL=http://localhost:3120 npx tsx scripts/authz02-e2e-browser.ts
```
(o seed recusa correr fora de uma BD local `file:…authz02…`).
