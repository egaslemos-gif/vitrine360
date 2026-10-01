# PRE-AUDIT

## Premissa da Auditoria

Foi reportado que:
- O perfil `SUPER_ADMIN` consegue adicionar/associar Ecrãs.
- Outros perfis recebem um erro na UI com o código técnico `ENTITLEMENT_DENIED`.

## Objectivos

1. Determinar de forma definitiva a causa do bloqueio (RBAC, Permissões, Tenant, Entitlements, Quotas, etc.).
2. Compreender a cadeia de autorização que leva à devolução de `ENTITLEMENT_DENIED`.
3. Analisar por que motivo o erro `ENTITLEMENT_DENIED` está a ser apresentado de forma errada para perfis que poderão apenas não ter a permissão de RBAC (`manage_devices`), ou se existe de facto um bloqueio de Entitlements que só afeta perfis não `SUPER_ADMIN` (o que seria uma violação da arquitetura, visto que Entitlements são ao nível do Tenant e não do Role).

## Pontos de Investigação

- **RBAC**: Quem tem a permissão `manage_devices`?
- **Device APIs**: Quais as rotas e quais os `guards` aplicados a operações sobre Devices?
- **Entitlements**: Como é avaliada a permissão `device.pair` e o limite `devices.max`? Existe alguma injeção do Role na decisão do Entitlement?
- **Error Mapping**: Como é que uma excepção de autorização (ex: 403 Forbidden) é traduzida e apresentada na UI?
