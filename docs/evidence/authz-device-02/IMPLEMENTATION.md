# IMPLEMENTATION — AUTHZ-DEVICE-02

## Ficheiros Alterados

### 1. `src/lib/api.ts` — Backend Error Handler
**Tipo**: Alteração
**Razão**: A função `handleApiError` emitia strings genéricas (`"Forbidden"`, `"Internal server error"`) no campo `error`, impossibilitando o frontend de distinguir entre erros de permissão, entitlements e quotas.
**Alteração**: Cada ramo emite agora um código de erro estruturado (`PERMISSION_DENIED`, `ENTITLEMENT_DENIED`, `QUOTA_EXCEEDED`, `TENANT_SUSPENDED`, `ACTIVATION_CODE_INVALID`, `DEVICE_ALREADY_REGISTERED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`). Adicionados ramos específicos para erros de domínio de dispositivos.

### 2. `src/lib/api-error-mapping.ts` — Frontend Error Mapper (NOVO)
**Tipo**: Criação
**Razão**: Não existia um mecanismo centralizado para traduzir códigos de erro da API em mensagens portuguesas.
**Conteúdo**: Exporta `mapApiErrorToUserMessage()` que converte payloads de erro em objectos `{ title, message, recoverable, _code }`. Inclui fallbacks por HTTP status para código legado.

### 3. `src/features/devices/pair-device-form.tsx` — PairDeviceForm
**Tipo**: Reescrita
**Alterações**:
- Substituição de `setError(data.error)` por `setError(mapApiErrorToUserMessage(data, res.status))`.
- Estado de `error` mudou de `string | null` para `UserErrorMessage | null`.
- Adicionado estado `submitting` para prevenir submissões duplas.
- Botão mostra "A associar Ecrã…" durante o loading.
- Inputs desactivados durante submissão.
- Valores do formulário preservados em caso de erro.
- Todos os campos limpos em caso de sucesso.
- Mensagem de sucesso com visual destacado.
- Mensagem de erro com título + descrição em bloco visual.

### 4. `src/lib/api-error-mapping.test.ts` — Tests (NOVO)
**Tipo**: Criação
**Conteúdo**: 13 testes unitários para o mapper de erros.

### 5. `src/domain/device-authz.test.ts` — Tests (NOVO)
**Tipo**: Criação
**Conteúdo**: 63 testes validando a matriz RBAC completa para todas as operações de dispositivos e todas as permissões.

## Ficheiros NÃO Alterados

- `src/domain/types.ts` — Roles e Permissions inalterados.
- `src/domain/platform-identity.ts` — Platform roles inalterados.
- `src/services/entitlements.ts` — Entitlements inalterados.
- `src/services/device-quota.ts` — Quotas inalteradas.
- `src/services/devices.ts` — Device service inalterado.
- `src/app/api/admin/devices/route.ts` — API route inalterada.
- `src/lib/auth.ts` — Auth/Session inalterado.
- `src/lib/admin-access.ts` — Admin access inalterado.
