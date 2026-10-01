# API-CONSUMER-COMPATIBILITY — AUTHZ-DEVICE-02B

## Working tree (passo 1)

Alterações relacionadas com AUTHZ-DEVICE-02: `src/lib/api.ts`, `src/lib/api-error-mapping.ts` (+ test), `src/features/devices/pair-device-form.tsx`, `src/domain/device-authz.test.ts`.
Alterações **não** relacionadas, vindas da tarefa MEDIA-RUNTIME-01 (Browser Lab): `src/app/player/lab/{page,layout}.tsx`, `src/lib/playback-lab-guard.ts`, `scripts/test-playback-lab-guard.ts`, `.env.example`, entrada `test:playback-lab-guard` em `package.json`.
Resíduos locais não versionados (removidos em RELEASE-HYGIENE-02): `build-current.txt`, `diff*.txt`, `lint-*.txt`, `test-results.txt`, `typecheck-current.txt`, `git-*.txt`.
Efeito colateral de `npm test`: reescreve vários `docs/evidence/{platform-identity,runtime-*}/*.md`.

## Descoberta: o AUTHZ-DEVICE-02 original quebrava consumidores

A primeira versão de `handleApiError` trocou `error` (texto legível) por um código em **todas** as categorias.
O `REGRESSION.md` anterior concluiu "sem regressão funcional", mas essa análise estava incompleta.
Esta tabela lista os consumidores realmente afectados e o que foi feito.

| Ficheiro | Consumidor | Contrato anterior | Contrato AUTHZ-02 original | Risco | Resolução |
|---|---|---|---|---|---|
| `src/features/media/direct-upload.ts:108` | `/direct upload not supported/i.test(data.error)` → fallback multipart | `error` = texto do erro | `error:"VALIDATION_ERROR"` → regex nunca casa | **ALTO: fallback de upload quebrado** | `legacyError()` repõe `error`=texto; `code`=`VALIDATION_ERROR` |
| `direct-upload.ts:46,108` | `error === "ENTITLEMENT_DENIED" \|\| "QUOTA_EXCEEDED"` | `error:"ENTITLEMENT_DENIED"`, `code:"QUOTA_EXCEEDED"` | `error` = código | nenhum (ambos aceites) | sem alteração |
| `scripts/test-platform-identity-10g.ts` e `10j.ts` | afirmavam `error==="ENTITLEMENT_DENIED"` com `code:"QUOTA_EXCEEDED"` | contrato antigo | `error:"QUOTA_EXCEEDED"` | `npm test` falhava (PI10G-ERROR e PI10J-ERROR) | asserção actualizada para o novo contrato (mudança intencional, spec: *QuotaExceeded → QUOTA_EXCEEDED*) |
| `members-manager.tsx`, `users-manager.tsx` | `setError(data.error)` | "Não pode alterar a própria role", "Membro não encontrado"… | `MEMBERSHIP_ERROR` (informação perdida) | MÉDIO (UX) | `legacyError()` mantém o texto |
| `content-studio-form.tsx`, `schedule-form.tsx`, `schedule-list-manager.tsx`, `workspace-settings-form.tsx`, `assign-playlist-form.tsx`, `login/page.tsx` (Zod) | `setError(data.error)` | mensagens do Zod | `VALIDATION_ERROR` | MÉDIO (UX) | idem |
| `media-library.tsx`, `device-actions.tsx` | `setError(data.error)` | texto "Not found"/"…utilizado…" | `NOT_FOUND`/`CONFLICT` | MÉDIO (UX) | idem |
| `device-actions.tsx` (PATCH com `deviceCode` repetido, `devices.ts:931`) | `data.error` | "Device code already in use" | `DEVICE_ALREADY_REGISTERED` (código visível) | BAIXO | **aceite**: `error` = código para estas duas categorias, como pedido na spec. Migrar este componente para o mapper numa fase futura |
| Qualquer consumidor com "Forbidden"/"Unauthorized" | `data.error` | texto | `PERMISSION_DENIED`/`AUTHENTICATION_REQUIRED` | BAIXO | grep: **nenhum** compara com "Forbidden"/"Unauthorized". Só os mostram |
| `login/route.ts` | `jsonError("Invalid credentials")` directo | inalterado | inalterado | nenhum | n/a |
| Rotas `/api/device/*` | `jsonError("Unauthorized"/"Forbidden")` directo (não usam `handleApiError`) | inalterado | inalterado | nenhum | n/a |

`handleApiError` é usado por 39 ficheiros. Nenhum faz refactor nesta fase.

## Contrato actual de `handleApiError`

| Categoria | HTTP | `error` | `code` | outros |
|---|---|---|---|---|
| AuthError 401 | 401 | `AUTHENTICATION_REQUIRED` | igual | `message` |
| AuthError 403 | 403 | `PERMISSION_DENIED` | igual | `message` |
| AuthError outros (400) | 400 | texto | `VALIDATION_ERROR` | `message` |
| EntitlementDeniedError (feature) | 403 | `ENTITLEMENT_DENIED` | igual | `entitlement`, `reason` |
| EntitlementDeniedError (quota) | 403 | `QUOTA_EXCEEDED` | igual | `entitlement`, `reason` |
| TenantLifecycleError | status original | **texto** | `TENANT_SUSPENDED` / `TENANT_ERROR` | `message` |
| MembershipError | status original | **texto** | `MEMBERSHIP_ERROR` | `message` |
| Activation inválido | 400 | `ACTIVATION_CODE_INVALID` | igual | `message` |
| Device já registado / já emparelhado | 400 | `DEVICE_ALREADY_REGISTERED` | igual | `message` |
| ZodError / validação | 400 | **texto** | `VALIDATION_ERROR` | `message` |
| Not found / conflito | 404 / 409 | **texto** | `NOT_FOUND` / `CONFLICT` | `message` |
| Desconhecido | 500 | `Internal server error` | `INTERNAL_ERROR` | sem stack |

O mapper (`mapApiErrorToUserMessage`) lê `code` primeiro (se conhecido) e só depois `error`.
Isto cobre payloads da spec (`{error:"…"}` só com `error`) e payloads legados.

## Desvios face à spec 02B (para decisão)
- 401: a spec indica `AUTHENTICATION_REQUIRED`. Foi renomeado de `UNAUTHENTICATED` (implementação anterior) para esse nome.
- "Device já registado": HTTP **400** (comportamento actual do backend), não 409. A spec aceita "ou status actual equivalente". A UI trata 400 e 409 igual (testado com mock 409).
