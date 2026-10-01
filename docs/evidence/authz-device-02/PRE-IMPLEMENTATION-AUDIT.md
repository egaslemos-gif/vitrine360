# PRE-IMPLEMENTATION AUDIT

## Componente Analisado

**Ficheiro**: `src/features/devices/pair-device-form.tsx`
**Tipo**: React Client Component ("use client")
**Utilização**: Importado por `src/app/admin/devices/page.tsx`

## Endpoint Chamado

**URL**: `POST /api/admin/devices`
**Handler**: `src/app/api/admin/devices/route.ts`

## Guard Chain no Backend (Ordem)

1. `requireSession("manage_devices")` → RBAC
2. `pairDevice(...)` internamente:
   - `assertTenantOperable(tenantId)` → Tenant lifecycle
   - `withTenantAllocationLock(tenantId, ...)` → Lock transacional
   - `assertDevicesEnabled(tenantId, "device.pair")` → Entitlement FEATURE_GATE
   - `assertDevicesMaxAllocation(tenantId, "device.pair", tx)` → Quota HARD_LIMIT
   - Lookup activation code → Domain validation
   - Verificação deviceCode duplicado → Domain validation

## Response Parsing Actual (Frontend)

```typescript
const data = (await res.json()) as { error?: string };
if (!res.ok) {
  setError(data.error ?? "Falha no pairing");
  return;
}
```

### Problema Identificado

O frontend lê `data.error` e apresenta-o DIRECTAMENTE ao utilizador.

Payloads devolvidos pelo backend em diferentes cenários:

| Cenário | Backend Error Class | Payload JSON | Frontend Mostra |
| --- | --- | --- | --- |
| RBAC fail (EDITOR) | `AuthError("Forbidden", 403)` | `{ "error": "Forbidden" }` | **"Forbidden"** |
| Entitlement fail | `EntitlementDeniedError` | `{ "error": "ENTITLEMENT_DENIED", "code": "..." }` | **"ENTITLEMENT_DENIED"** |
| Quota exceeded | `EntitlementDeniedError` | `{ "error": "ENTITLEMENT_DENIED", "code": "QUOTA_EXCEEDED" }` | **"ENTITLEMENT_DENIED"** |
| Activation invalid | `Error("Invalid...")` | `{ "error": "Invalid or expired activation code" }` | **"Invalid or expired activation code"** |
| Device code dup | `Error("Device code already...")` | `{ "error": "Device code already in use" }` | **"Device code already in use"** |
| Tenant suspended | `TenantLifecycleError` | `{ "error": "Tenant is not operable" }` | **"Tenant is not operable"** |

**Nenhum destes textos é adequado para apresentação directa ao utilizador final.**

## Estado do Botão

O botão `<Button type="submit">Associar dispositivo</Button>`:
- Não tem indicador de loading.
- Não desativa submissão duplicada.
- Não limpa estado após sucesso (limpa apenas `activationCode`, mas não `name`, `location`, `deviceCode`).

## Visibilidade do Formulário

A página `devices/page.tsx` já protege a página inteira com `requireAdminPage("manage_devices")` e renderiza `<AccessDenied />` se o role não tiver a permissão. Isto significa que um EDITOR/VIEWER **não deveria sequer ver o formulário** na renderização SSR.

Contudo, se um utilizador aterrar nessa página com cache stale ou se a sessão mudar entre o render e o submit, o POST falha e mostra o erro cru.

## Plano de Correcção

1. **Criar `src/lib/api-error-mapping.ts`** — mapper centralizado frontend.
2. **Melhorar `src/lib/api.ts` (backend)** — produzir `error codes` estruturados para `AuthError` e `TenantLifecycleError`.
3. **Reescrever `PairDeviceForm`** — usar o mapper, loading state, submissão dupla, mensagens humanas.
4. **Criar testes unitários** para o mapper e para a RBAC matrix.
5. **Não alterar RBAC, Entitlements, Quotas, Tenant, Device schema.**
