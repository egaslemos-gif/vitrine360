# FINAL REPORT: AUTHORIZATION AUDIT

Auditoria completa da autorização de Ecrãs (Devices) sobre os blocos de controlo RBAC, Entitlements, Quotas e Tenant Lifecycle.

## Respostas Finais

**1. Quem pode actualmente criar Ecrãs?**
`SUPER_ADMIN`, `ADMIN` e `OPERATOR` (via permissão `manage_devices`).

**2. Quem pode associar Ecrãs?**
`SUPER_ADMIN`, `ADMIN` e `OPERATOR` (a criação e associação são o mesmo endpoint).

**3. Quem pode editar?**
`SUPER_ADMIN`, `ADMIN` e `OPERATOR`.

**4. Quem pode eliminar?**
`SUPER_ADMIN`, `ADMIN` e `OPERATOR`.

**5. Quem pode gerir grupos?**
`SUPER_ADMIN`, `ADMIN` e `OPERATOR`.

**6. Qual permission controla cada operação?**
`manage_devices`. Está mapeada nas constantes de `src/domain/types.ts`.

**7. Qual entitlement controla cada operação?**
O Feature Gate `devices.enabled` (constante `DEVICES_ENABLED_KEY`). Determina se o tenant está autorizado a ter Ecrãs. Atinge operações de associação e reactivação.

**8. Qual quota controla Ecrãs?**
A variável `devices.max` (constante `DEVICES_MAX_KEY`). Actua como Allocation Guard no momento de criação/associação ou reactivação de Ecrãs.

**9. Porque o caso da imagem (não SUPER_ADMIN) retorna ENTITLEMENT_DENIED?**
Porque existe um bug na camada UI (mapeamento visual de erros). Na API (Backend), a função de Entitlement (`enforceEntitlement`) depende EXCLUSIVAMENTE do plano associado ao Tenant. A avaliação não acede ao Token, nem ao Role do invocador.
Isto significa que um Entitlement falha *exactamente de igual forma* para `SUPER_ADMIN` e para `OPERATOR`.
Se um perfil `SUPER_ADMIN` consegue, e um perfil inferior como `EDITOR` ou `VIEWER` recebe "ENTITLEMENT_DENIED", é devido à falha precoce de RBAC: O `requireSession("manage_devices")` bloqueia o perfil devolvendo o JSON de AuthError `{"error": "Forbidden"}` (HTTP 403). O componente de React (UI) parece estar a capturar qualquer 403, falhando ao não descodificar o payload e imprimindo a mesma constant `ENTITLEMENT_DENIED` que usaria se o entitlement realmente não estivesse presente.

**10. O comportamento actual está de acordo com a arquitectura?**
Na parte das APIs de Backend e Infraestrutura: **SIM**. A separação entre Auth, Operability, Entitlement e Quota é perfeita e estrita.
Na experiência do Utilizador (Frontend/Error Mapping): **NÃO**. Um utilizador sem permissão não deve ser informado que o "plano não tem Ecrãs", mas sim de que "não possui privilégios de gestão".

**11. Quais permissões estão demasiado abertas?**
Nenhum caso evidente de sobreexposição. A matriz atual (`SUPER_ADMIN`, `ADMIN`, `OPERATOR`) faz sentido do ponto de vista do domínio de negócio para a gestão de Dispositivos físicos (Digital Signage).

**12. Quais estão demasiado restritivas?**
A matriz está correta. Editores não deveriam poder registar novo hardware físico. O seu acesso deve manter-se circunscrito à emissão do conteúdo.

**13. Quais mensagens de erro precisam de melhoria?**
As mensagens de alerta exibidas pelas actions e forms no React. Devem ser mapeadas caso-a-caso lendo os atributos detalhados:
- Se json.error == `"Forbidden"` -> "Permissão Insuficiente".
- Se json.error == `"ENTITLEMENT_DENIED"` && json.code == `"QUOTA_EXCEEDED"` -> "Limite de Ecrãs Atingido".
- Se json.error == `"ENTITLEMENT_DENIED"` && json.code == `"ENTITLEMENT_DENIED"` -> "Funcionalidade Não Disponível No Seu Plano".

**14. Que alterações são necessárias?**
NENHUMA a nível de infraestrutura, `types`, `entitlements`, `quotas` ou definições do Tenant.
Apenas devem ser alterados os painéis e formulários da UI (e/ou hook/action call handlers) onde os erros são impressos, nomeadamente no ecrã de Associação e Gestão de Ecrãs.
A permissão e os roles NÂO necessitam de qualquer ajustamento ou "by-pass".

---

**REGRA FINAL DA AUDITORIA CONCLUÍDA:**
Foi demonstrado formalmente que a falha NÃO advém de um bloqueio da camada Entitlements, pois esta ignora roles e bloquearia igualmente o SUPER_ADMIN caso o plano não estivesse aprovado. Tratou-se de uma falha de UI em que falhas de verificação por falta do RBAC (`manage_devices`) causam HTTP 403, e são renderizados ao cliente erradamente. O código de Backend encontra-se robusto e a funcionar de acordo com a arquitetura definida.
