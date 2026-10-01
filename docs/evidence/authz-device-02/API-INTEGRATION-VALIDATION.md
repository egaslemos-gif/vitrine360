# API-INTEGRATION-VALIDATION — AUTHZ-DEVICE-02B

Método: `src/lib/api.test.ts` (testes directos de `handleApiError`) + `scripts/authz02-e2e-browser.ts` (backend real, Next.js em modo produção, BD SQLite descartável `data/authz02-e2e.db`, `ENTITLEMENTS_ENABLED=true`).
Nenhuma BD remota foi usada: o seed recusa correr se `DATABASE_URL` não for `file:…authz02…`.

## 1. handleApiError por categoria (status + error + code + payload)

| Caso | HTTP | error | code | Verificado |
|---|---|---|---|---|
| AuthError 401 | 401 | AUTHENTICATION_REQUIRED | AUTHENTICATION_REQUIRED | teste + backend real |
| AuthError 403 | 403 | PERMISSION_DENIED | PERMISSION_DENIED | teste + backend real |
| Entitlement (feature) | 403 | ENTITLEMENT_DENIED | ENTITLEMENT_DENIED | `entitlement`, `reason` presentes; real |
| Quota | 403 | QUOTA_EXCEEDED | QUOTA_EXCEEDED | `entitlement=devices.max`; real |
| TenantLifecycle NOT_OPERABLE | 403 | texto legado | TENANT_SUSPENDED | mapper → "Espaço de trabalho suspenso" |
| Activation inválido | 400 | ACTIVATION_CODE_INVALID | ACTIVATION_CODE_INVALID | teste + real |
| Device já registado | 400 | DEVICE_ALREADY_REGISTERED | DEVICE_ALREADY_REGISTERED | ambos os textos de domínio; real |
| Desconhecido | 500 | Internal server error | INTERNAL_ERROR | não vaza mensagem/stack |
| Não-Error lançado | 500 | idem | INTERNAL_ERROR | |
| Zod / direct-upload / Membership / NotFound / Conflict | status original | texto preservado | código estruturado | garante compatibilidade (ver API-CONSUMER-COMPATIBILITY.md) |

Resultado: **93 testes** (`npm run test:authz-device-02`: `api.test.ts` + `api-error-mapping.test.ts` + `device-authz.test.ts`), 0 falhas.

## 2. Fluxo submit → fetch → HTTP → parse → mapper → UI (browser real)

| Caso | Origem | Resposta | UI |
|---|---|---|---|
| A Permission | mock `403 {error:"PERMISSION_DENIED"}` + **real** (ver ROLE-VALIDATION) | 403 | "Permissão insuficiente" |
| B Entitlement | mock + **real** (ENTITLEMENT-VALIDATION) | 403 | "Funcionalidade indisponível" |
| C Quota | mock + **real** (QUOTA-VALIDATION) | 403 | "Limite de Ecrãs atingido" |
| D Activation inválido | mock + **real** (código `000000`) | 400 | "Código de activação inválido" |
| E Já registado | mock **409** + **real** (400, `DUP-001`) | 409 / 400 | "Ecrã já associado" |
| F Sucesso | **real** | 200 | "Ecrã associado com sucesso. …" ; lista actualizada com o novo nome |
| Interno | mock 500 | 500 | "Não foi possível completar a operação" |
| Legado `{error:"Forbidden"}` | mock 403 | 403 | "Permissão insuficiente" |

Em todos: nenhum código técnico (`PERMISSION_DENIED`, `ENTITLEMENT_DENIED`, `QUOTA_EXCEEDED`, …) aparece no texto da página.

## 3. Submissão duplicada
Resposta atrasada 1,2 s; `btn.click()` ×3 **e** `form.requestSubmit()` ×3 no mesmo tick.
- Pedidos POST: **1**.
- Durante o envio: botão `disabled`, texto "A associar Ecrã…".
- Após resposta: botão reactivado.
- Fix introduzido: guard síncrono `useRef` (o guard por `useState` não é fiável para eventos no mesmo tick).

## 4. Preservação do formulário
- Erro (activation inválido, real): código, ID, nome e localização **mantidos** (4/4).
- Erro (entitlement / quota / permissão reais): valores mantidos.
- Sucesso: só o código de activação é limpo (UX original). O AUTHZ-02 limpava também nome, local e ID (e repunha `TV-HALL-001`). Foi **revertido** para a UX original, como pede a spec ("limpar apenas aquilo que a UX actual determina").
