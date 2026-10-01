# DEVICE API AUDIT

Auditoria às rotas que expõem operações sobre Ecrãs (Devices).

## 1. Rota de Registo / Emparelhamento
**Method**: `POST`
**Route**: `/api/admin/devices` (`src/app/api/admin/devices/route.ts`)
**Session Guard**: `requireSession("manage_devices")`
**Tenant Guard**: Sim (`assertTenantOperable(params.tenantId)` invocado via `pairDevice` em `src/services/devices.ts`)
**Entitlement Guard**: Sim (`assertDevicesEnabled` avaliado dentro de `withTenantAllocationLock`)
**Quota Guard**: Sim (`assertDevicesMaxAllocation` avaliado na mesma transação)
**Domain Validation**: Sim (validação do schema no body usando zod)
**Result Codes**: `200 OK`, `400 Bad Request` (ZodError/Invalid), `401 Unauthorized`, `403 Forbidden` (AuthError), `403 Forbidden` com `{ error: "ENTITLEMENT_DENIED" }` via HandleApiError.

## 2. Rota de Listagem de Devices (Read)
**Method**: `GET`
**Route**: `/api/admin/devices` (`src/app/api/admin/devices/route.ts`)
**Session Guard**: `requireSession("manage_devices")`
*(O acesso de leitura na API também exige `manage_devices` neste ficheiro)*
**Tenant Guard**: `isTenantOperable` já é validado pelo `requireSession`.
**Entitlement Guard**: Não aplicável (leitura não consome quota).

## 3. Rota de Alterar Estado / Rodar Token
**Method**: `PATCH`
**Route**: `/api/admin/devices/[id]` (`src/app/api/admin/devices/[id]/route.ts`)
**Session Guard**: `requireSession("manage_devices")`
**Tenant Guard**: Avaliado dentro de `setDeviceStatus` se for uma reactivação (allocating again).
**Entitlement Guard**: Apenas se `status === "ACTIVE"` (reativação avalia `assertDevicesEnabled("device.reactivate")`).
**Quota Guard**: Apenas se `status === "ACTIVE"` (reativação consome quota).

## 4. Rota de Actualizar Device (Meta)
**Method**: `PUT`
**Route**: `/api/admin/devices/[id]`
**Session Guard**: `requireSession("manage_devices")`
**Entitlement Guard**: Nenhum específico na actualização de meta-dados.
**Quota Guard**: Não consome quota (o ecrã já está alocado).

## 5. Rota de Eliminar (Desassociar)
**Method**: `DELETE`
**Route**: `/api/admin/devices/[id]`
**Session Guard**: `requireSession("manage_devices")`
**Entitlement Guard**: Nenhum (não cria ecrãs, apenas liberta).
**Quota Guard**: Nenhum.

## 6. Observabilidade de Ecrã Único
**Method**: `GET`
**Route**: `/api/admin/devices/[id]`
**Session Guard**: `requireSession("view_dashboard")` (Note a diferença: leitura individual exige apenas `view_dashboard`)
**Tenant Guard**: Aplicável via session.
**Entitlement Guard**: Nenhum.

---
## Conclusão da Auditoria de APIs
O RBAC exige `manage_devices` para adicionar/emparelhar um Ecrã. Se um Utilizador sem essa permissão tentar fazer a chamada (por exemplo, via falha na interface que permita ver o botão), receberá uma `AuthError("Forbidden", 403)`.
Os Ecrãs exigem a verificação de Entitlements (`assertDevicesEnabled`) e Quotas (`assertDevicesMaxAllocation`) no momento de criar/associar e de reactivar. Se falharem, emitem `EntitlementDeniedError` com HTTP 403.
