# ENTITLEMENT DEVICE AUDIT

Auditoria aos Entitlements e Quotas relacionadas com Gestão de Ecrãs (Devices).

## 1. Feature Gate (Entitlement Definition)
A capacidade de gerir ecrãs é controlada primariamente pelo Entitlement: `devices.enabled` (constante `DEVICES_ENABLED_KEY`).
- **Função**: `assertDevicesEnabled(tenantId, operation)`
- **Enforcement Type**: `FEATURE_GATE` (Boolean).
- **Objectivo**: Liga ou desliga a funcionalidade base de ecrãs. Se o plano não possuir este Entitlement com valor `true`, nenhuma quota é avaliada. A operação falha imediatamente com `EntitlementDeniedError`.

## 2. Quota / Limite (Device Quota)
O limite de ecrãs que podem existir no Tenant é controlado pela Quota: `devices.max` (constante `DEVICES_MAX_KEY`).
- **Função**: `assertDevicesMaxAllocation(tenantId, operation, tx)`
- **Enforcement Type**: Pode ser configurado como `HARD_LIMIT` ou `SOFT_LIMIT` na definição (por omissão é tratado como hard limit ao nível de allocation).
- **Validação de Usage**: O uso é calculado com a função `countDevices(tenantId, DEVICE_COUNT_MODE_CANONICAL)`.
- **Objectivo**: Assegurar que o Tenant não tem um número activo de Ecrãs superior ao valor inteiro permitido pela variável `devices.max`. Se exceder, devolve erro 403.

## 3. Momento da Verificação
As verificações de Entitlement e de Quota são executadas APÓS a avaliação do RBAC e da Sessão:
1. `requireSession("manage_devices")` avalia RBAC.
2. `assertTenantOperable(tenantId)` avalia Tenant Suspension.
3. Lock Transacional ao nível do Tenant (`withTenantAllocationLock`) é adquirido.
4. `assertDevicesEnabled(...)` avalia o Feature Gate.
5. `assertDevicesMaxAllocation(...)` avalia a Quota.
6. Registo em DB e finalização.

## 4. Diferenciação da Resposta de Erro
A Excepção `EntitlementDeniedError` diferencia a resposta entre `ENTITLEMENT_DENIED` (quando o recurso ou funcionalidade não existe no plano) e `QUOTA_EXCEEDED` (quando existe, mas foi atingido o número máximo permitido):

```typescript
// device-quota.ts
if (decision.decision === "INVALID" || decision.blocksAllocation) {
  throw new EntitlementDeniedError(
    DEVICES_MAX_KEY,
    decision.decision === "INVALID" ? "INVALID_ENTITLEMENT" : "QUOTA_EXCEEDED",
    403,
    "QUOTA_EXCEEDED", // responseCode interno na class
  );
}
```

E no caso de bloqueio puro do FEATURE_GATE, a excepção devolve o default, que é `ENTITLEMENT_DENIED`.
