# TEST MATRIX

Esta matriz define os cenários para teste de integração ou testes End-to-End da Autorização de Ecrãs e verifica a aderência entre a infraestrutura e as camadas do Domínio de Entitlements, Roles e UX.

## 1. Testes Base de Perfil (Isolar RBAC de Entitlement)

Para que a UI exiba a mensagem ou bloqueie o Ecrã correctos e nunca mostre erro genérico incorreto, tem de responder de acordo com esta tabela, **ASSUMINDO QUE O TENANT TEM O PLANO COMPATIBILITY / ENTITLEMENT=TRUE e QUOTAS ABERTAS.**

| User Role | Operation | RBAC Guard Decision | Final HTTP Return | Expected Payload |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN | `POST /api/admin/devices` | ALLOW | `200 OK` | `{ paired: true }` |
| ADMIN | `POST /api/admin/devices` | ALLOW | `200 OK` | `{ paired: true }` |
| OPERATOR | `POST /api/admin/devices` | ALLOW | `200 OK` | `{ paired: true }` |
| EDITOR | `POST /api/admin/devices` | DENY | `403 Forbidden` | `{ error: "Forbidden" }` |
| VIEWER | `POST /api/admin/devices` | DENY | `403 Forbidden` | `{ error: "Forbidden" }` |

Se a verificação empírica falhar e um Admin ver `ENTITLEMENT_DENIED`, então significa que o Bug reside num fallback visual da interface, visto que a infraestrutura responde `ALLOW` aos três perfis.

## 2. Cenários Combinados de Avaliação de Casos Práticos

Avaliando a ordem de declaração no Ficheiro `src/services/devices.ts`:
1. Check RBAC (Via RequireSession guard API level).
2. Check Operability.
3. Check Entitlement Enablement.
4. Check Entitlement Quota.

### Caso A (Happy Path)
- **RBAC**: ALLOW (SUPER_ADMIN)
- **Entitlement**: ALLOW
- **Quota**: ALLOW
- **Tenant Status**: ACTIVE
- **-> Expectativa**: `200 SUCCESS` (Device associado).

### Caso B (Falha RBAC Pura)
- **RBAC**: DENY (EDITOR)
- **Entitlement**: ALLOW
- **Quota**: ALLOW
- **-> Expectativa**: `403 Forbidden` com Error JSON `{ "error": "Forbidden" }`. UX mostra "Permissão insuficiente".

### Caso C (Falha Feature Gate)
- **RBAC**: ALLOW (ADMIN)
- **Entitlement**: DENY (`devices.enabled`=false)
- **-> Expectativa**: `403 Forbidden` com JSON `{ "error": "ENTITLEMENT_DENIED", "code": "ENTITLEMENT_DENIED" }`. UX mostra "Funcionalidade não disponível".

### Caso D (Falha Quota Excedida)
- **RBAC**: ALLOW (ADMIN)
- **Entitlement**: ALLOW
- **Quota**: EXCEEDED (`devices.max` atingido)
- **-> Expectativa**: `403 Forbidden` com JSON `{ "error": "ENTITLEMENT_DENIED", "code": "QUOTA_EXCEEDED" }`. UX mostra "Limite de Ecrãs atingido".

### Caso E (Falha Tenant Lifecycle)
- **RBAC**: ALLOW
- **Entitlement**: ALLOW
- **Tenant**: SUSPENDED
- **-> Expectativa**: Falha antes da verificação do Feature Gate, emitindo excepção na validação Operável. `403 Forbidden` com JSON dependente da validação `TenantLifecycleError`.

As implementações de UI (React) deverão prever cada payload único e exibir a mensagem mapeada adequada.
