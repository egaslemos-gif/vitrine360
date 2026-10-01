# QUOTA-VALIDATION — AUTHZ-DEVICE-02B

Setup real: `ENTITLEMENTS_ENABLED=true`; tenant `authz02-quota` com `devices.enabled=true`, `devices.max=1` e 1 dispositivo já associado (uso 1 ≥ máx 1). Utilizador ADMIN.

| Camada | Resultado |
|---|---|
| RBAC | ALLOW |
| Entitlement (`devices.enabled`) | ALLOW |
| Quota (`devices.max`) | **DENY** |
| API | `403 {"error":"QUOTA_EXCEEDED","code":"QUOTA_EXCEEDED","entitlement":"devices.max","reason":"QUOTA_EXCEEDED"}` |
| UI | "Limite de Ecrãs atingido" + "O espaço de trabalho atingiu o limite de Ecrãs permitido pelo plano actual." |

- Não aparece "Permissão insuficiente" nem `ENTITLEMENT_DENIED` nem o código.
- Valores preservados. 1 POST. Sem erros de página. O tentado não consome o código de activação (a verificação de quota precede a do código).
- A ordem das camadas confirma-se em `src/services/devices.ts` (`assertDevicesEnabled` → `assertDevicesMaxAllocation` → validação do código).
- Screenshot: `screenshots/real-quota.png`.
