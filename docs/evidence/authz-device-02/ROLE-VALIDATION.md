# ROLE-VALIDATION — AUTHZ-DEVICE-02B

Backend real (login por `/api/auth/login`, cookie de sessão, `POST /api/admin/devices`). Cada role tem um utilizador próprio em cada um de 3 tenants.
Resultados completos: `e2e-results.json`.

## Matriz role × camada (15/15 como esperado)

| Role | Tenant normal (plano OK, quota livre) | Tenant `devices.enabled=false` | Tenant quota cheia (1/1) |
|---|---|---|---|
| VIEWER | 403 `PERMISSION_DENIED` (RBAC) | 403 `PERMISSION_DENIED` (RBAC) | 403 `PERMISSION_DENIED` (RBAC) |
| EDITOR | 403 `PERMISSION_DENIED` (RBAC) | 403 `PERMISSION_DENIED` (RBAC) | 403 `PERMISSION_DENIED` (RBAC) |
| OPERATOR | **200 SUCCESS** | 403 `ENTITLEMENT_DENIED` | 403 `QUOTA_EXCEEDED` |
| ADMIN | **200 SUCCESS** | 403 `ENTITLEMENT_DENIED` | 403 `QUOTA_EXCEEDED` |
| SUPER_ADMIN | **200 SUCCESS** | 403 `ENTITLEMENT_DENIED` | 403 `QUOTA_EXCEEDED` |

- OPERATOR / ADMIN / SUPER_ADMIN só são marcados SUCCESS por terem atravessado RBAC → Entitlement → Quota → Domain (dispositivo criado, `200`).
- RBAC corre primeiro: VIEWER/EDITOR recebem sempre `PERMISSION_DENIED`, mesmo em tenants com entitlement desligado ou quota cheia, nunca `ENTITLEMENT_DENIED`.
- Em cada resposta de erro, `error` e `code` coincidem.

## Caso reportado (utilizador sem `manage_devices`)
Browser, `OPERATOR` com o formulário aberto e sucesso real anterior; a role foi despromovida a `VIEWER` na BD antes do segundo submit.
- API: `403 {"error":"PERMISSION_DENIED","code":"PERMISSION_DENIED","message":"Forbidden"}`.
- UI: "Permissão insuficiente" + mensagem em português. Não aparece `ENTITLEMENT_DENIED`, nem "Funcionalidade indisponível", nem o código.
- Valores do formulário mantidos.

## EDITOR / VIEWER na UI
A página `/admin/devices` mostra "Acesso negado" e **não renderiza** o formulário. Chamada directa à API com a sessão deles: 403 `PERMISSION_DENIED`.
Testes unitários RBAC (`device-authz.test.ts`, 63 casos): permissão `manage_devices` só em OPERATOR/ADMIN/SUPER_ADMIN.
