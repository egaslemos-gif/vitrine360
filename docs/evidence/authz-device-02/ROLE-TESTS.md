# ROLE TESTS — AUTHZ-DEVICE-02

## Testes Executados

### 1. `src/domain/device-authz.test.ts` — RBAC Device Authorization

**63 testes** cobrindo:

#### Grupo 1: RBAC Device Authorization Matrix (5 testes)
Valida se cada role tem ou não a permissão `manage_devices`:

| Role | Resultado | Esperado |
| --- | --- | --- |
| SUPER_ADMIN | ✅ ALLOW | ALLOW |
| ADMIN | ✅ ALLOW | ALLOW |
| OPERATOR | ✅ ALLOW | ALLOW |
| EDITOR | ✅ DENY | DENY |
| VIEWER | ✅ DENY | DENY |

#### Grupo 2: RBAC Device Operations Per Role (20 testes)
Valida cada combinação de role × operação:

| Role | CREATE | PAIR | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| ADMIN | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| OPERATOR | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| EDITOR | ✅ DENY | ✅ DENY | ✅ DENY | ✅ DENY |
| VIEWER | ✅ DENY | ✅ DENY | ✅ DENY | ✅ DENY |

#### Grupo 3: RBAC Complete Permission Matrix (35 testes)
Valida TODAS as 7 permissions para TODOS os 5 roles.

### 2. `src/lib/api-error-mapping.test.ts` — Error Mapper

**13 testes** cobrindo:

- PERMISSION_DENIED → "Permissão insuficiente"
- ENTITLEMENT_DENIED → "Funcionalidade indisponível"
- QUOTA_EXCEEDED → "Limite de Ecrãs atingido"
- TENANT_SUSPENDED → "Espaço de trabalho suspenso"
- ACTIVATION_CODE_INVALID → "Código de activação inválido"
- DEVICE_ALREADY_REGISTERED → "Ecrã já associado"
- VALIDATION_ERROR → usa mensagem do servidor
- UNAUTHENTICATED → "Sessão expirada"
- INTERNAL_ERROR → fallback genérico
- null payload → fallback seguro
- código desconhecido com 403 → fallback para PERMISSION_DENIED
- nenhum título contém código técnico raw

### 3. `src/domain/types.test.ts` — Existentes (Regressão)

**10 testes** de `derivePresence` — sem alterações, todos passam.

## Resultados

```
# tests 86
# pass 86
# fail 0
```
