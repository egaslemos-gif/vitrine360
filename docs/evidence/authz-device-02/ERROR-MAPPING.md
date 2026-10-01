# ERROR MAPPING — AUTHZ-DEVICE-02

## Alterações Implementadas

### 1. Backend: `src/lib/api.ts` — `handleApiError()`

A função `handleApiError` foi actualizada para emitir **códigos de erro estruturados** no campo `error` do JSON de resposta, em vez de strings genéricas como `"Forbidden"`.

**Antes:**
```json
// AuthError("Forbidden", 403)
{ "error": "Forbidden" }

// EntitlementDeniedError
{ "error": "ENTITLEMENT_DENIED", "code": "ENTITLEMENT_DENIED" }
```

**Depois:**
```json
// AuthError("Forbidden", 403)
{ "error": "PERMISSION_DENIED", "message": "Forbidden" }

// AuthError("Unauthorized", 401)
{ "error": "UNAUTHENTICATED", "message": "Unauthorized" }

// EntitlementDeniedError (FEATURE_GATE)
{ "error": "ENTITLEMENT_DENIED", "code": "ENTITLEMENT_DENIED", "entitlement": "devices.enabled" }

// EntitlementDeniedError (QUOTA)
{ "error": "QUOTA_EXCEEDED", "code": "QUOTA_EXCEEDED", "entitlement": "devices.max" }

// TenantLifecycleError (NOT_OPERABLE)
{ "error": "TENANT_SUSPENDED", "message": "..." }

// ZodError
{ "error": "VALIDATION_ERROR", "message": "..." }

// "Invalid or expired activation code"
{ "error": "ACTIVATION_CODE_INVALID", "message": "..." }

// "Device code already in use"
{ "error": "DEVICE_ALREADY_REGISTERED", "message": "..." }

// Interno / desconhecido
{ "error": "INTERNAL_ERROR", "message": "Internal server error" }
```

### 2. Frontend: `src/lib/api-error-mapping.ts` — `mapApiErrorToUserMessage()`

Mapper centralizado que converte os códigos estruturados em mensagens portuguesas:

| Código Backend | Título UI | Recuperável |
| --- | --- | --- |
| `PERMISSION_DENIED` | "Permissão insuficiente" | Não |
| `UNAUTHENTICATED` | "Sessão expirada" | Não |
| `ENTITLEMENT_DENIED` | "Funcionalidade indisponível" | Não |
| `QUOTA_EXCEEDED` | "Limite de Ecrãs atingido" | Não |
| `TENANT_SUSPENDED` | "Espaço de trabalho suspenso" | Não |
| `ACTIVATION_CODE_INVALID` | "Código de activação inválido" | Sim |
| `DEVICE_ALREADY_REGISTERED` | "Ecrã já associado" | Sim |
| `VALIDATION_ERROR` | "Dados inválidos" | Sim |
| `INTERNAL_ERROR` | "Não foi possível completar a operação" | Sim |

### 3. Frontend: `src/features/devices/pair-device-form.tsx`

O formulário foi reescrito para:
- Usar `mapApiErrorToUserMessage()` em vez de `data.error` directo.
- Apresentar título + descrição em vez de código técnico.
- Bloquear submissão duplicada (`submitting` state).
- Mostrar texto "A associar Ecrã…" durante o pedido.
- Preservar valores do formulário em caso de erro recuperável.
- Limpar todos os campos em caso de sucesso.
- Mostrar confirmação visual de sucesso.

### 4. Compatibilidade Retroativa

- A alteração no backend mantém o campo `error` como string. Todos os consumidores existentes continuam a funcionar.
- O `direct-upload.ts` verifica `data.error === "ENTITLEMENT_DENIED" || data.error === "QUOTA_EXCEEDED"`, que continua a funcionar visto que os códigos emitidos são os mesmos.
- Outros formulários que fazem `setError(data.error ?? "...")` verão códigos como `PERMISSION_DENIED` em vez de `Forbidden` — funcionalmente equivalente e preparado para futura migração ao mapper.
