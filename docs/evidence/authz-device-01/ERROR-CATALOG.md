# ERROR CATALOG

Análise e mapeamento de como os erros das APIs convertem e como devem ser apresentados à UI.

O sistema intercepta excepções na camada de infraestrutura via o ficheiro `src/lib/api.ts` -> `handleApiError(error: unknown)`.

## 1. AuthError ("Forbidden")
**Technical Code**: N/A (Mapeado apenas como `{ "error": "Forbidden" }` no payload JSON).
**HTTP Status**: `403 Forbidden`
**Cause**: RBAC (O utilizador tentou usar uma função como criar Ecrãs mas não possui a permissão `manage_devices`).
**Current UI Behaviour**: Assumido frequentemente pelo Frontend como erro genérico se faltarem mapeamentos locais rigorosos. Se o UI exibir a technical key `ENTITLEMENT_DENIED` para qualquer `403`, isto é um Bug de UX.
**RECOMMENDED UX**:
- **Title**: "Permissão insuficiente"
- **Message**: "O seu perfil não tem permissão para gerir Ecrãs."
- **Action**: Pedir a um Administrador ou proprietário do Espaço de Trabalho (Tenant) para conceder o perfil de `ADMIN` ou `OPERATOR`.

## 2. EntitlementDeniedError ("ENTITLEMENT_DENIED")
**Technical Code**: `ENTITLEMENT_DENIED`
**HTTP Status**: `403 Forbidden`
**Cause**: O plano actual atribuído ao Tenant não permite gerir ou utilizar Ecrãs (A variável `devices.enabled` avaliou para `false`).
**RECOMMENDED UX**:
- **Title**: "Funcionalidade não disponível"
- **Message**: "O plano actual do espaço de trabalho não permite associar ou gerir Ecrãs."
- **Action**: Atualizar o plano do Espaço de Trabalho.

## 3. EntitlementDeniedError ("QUOTA_EXCEEDED")
**Technical Code**: `QUOTA_EXCEEDED`
**HTTP Status**: `403 Forbidden`
**Cause**: O Tenant atingiu o número máximo de Ecrãs activos definidos pelo plano (`devices.max`).
**RECOMMENDED UX**:
- **Title**: "Limite de Ecrãs atingido"
- **Message**: "O espaço de trabalho atingiu o número máximo de Ecrãs permitidos pelo plano atual."
- **Action**: Remover um ecrã inativo ou fazer o upgrade do plano para expandir a quota de ecrãs.

## 4. AuthError ("Tenant required")
**Technical Code**: N/A (`{ "error": "Tenant required" }`)
**HTTP Status**: `403 Forbidden`
**Cause**: Sessão activa mas não associada a nenhum espaço de trabalho operável.
**RECOMMENDED UX**:
- **Title**: "Espaço de Trabalho Inválido"
- **Message**: "Esta acção exige a selecção de um espaço de trabalho activo."

## 5. TenantLifecycleError
**Technical Code**: Variável dependendo da mensagem da excepção.
**HTTP Status**: `403 Forbidden` ou `400 Bad Request`
**Cause**: O Tenant foi suspenso ou apagado.
**RECOMMENDED UX**:
- **Title**: "Conta Suspensa"
- **Message**: "O espaço de trabalho associado a esta operação encontra-se suspenso."

---

*Nota Arquitectónica*: Nunca se deve devolver a string técnica nua (raw strings) ou keys puras para o utilizador final sem que exista uma conversão num dicionário de tradução (`i18n` ou local).
