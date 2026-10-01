# ENTITLEMENT-VALIDATION — AUTHZ-DEVICE-02B

Setup real: `ENTITLEMENTS_ENABLED=true`; tenant `authz02-disabled` com plano ACTIVE com `devices.enabled=false` (e `devices.max=100`). Utilizador ADMIN (tem `manage_devices`).

| Camada | Resultado |
|---|---|
| RBAC | ALLOW (passou) |
| Entitlement | **DENY** |
| API | `403 {"error":"ENTITLEMENT_DENIED","code":"ENTITLEMENT_DENIED","entitlement":"devices.enabled","reason":"FEATURE_DISABLED"}` |
| UI | "Funcionalidade indisponível" + "A gestão de Ecrãs não está disponível para este espaço de trabalho. Contacte o administrador da plataforma." |

- Não aparece "Permissão insuficiente" nem o código técnico.
- Valores do formulário mantidos. Exactamente 1 POST. Sem erros de página.
- Os 3 roles com permissão (OPERATOR/ADMIN/SUPER_ADMIN) obtêm o mesmo resultado na matriz (ver ROLE-VALIDATION).
- Screenshot: `screenshots/real-disabled.png`.

Nota: com `ENTITLEMENTS_ENABLED` ausente ou `false` (default), as camadas Entitlement/Quota são no-op e o pairing passa para o domínio. Isto é comportamento pré-existente (PI-10B) e não foi alterado.
