# AUTHORIZATION FLOW

Análise do fluxo de autorização aplicado à criação/associação de Ecrã (caso da Imagem, Activation Code 463748).

## Fluxo Teórico Completo

Quando o frontend submete um pedido `POST /api/admin/devices`:

1. **Authentication Layer (`requireSession`)**
   - Decodifica a cookie de sessão JWT.
   - Vai buscar o membro do Tenant actual e respectivo Role.
   - Avalia a Operabilidade do Tenant (não suspenso, não apagado).
   - Resultado: Devolve context ou rejeita (401 Unauthorized / 403 Forbidden).

2. **RBAC Guard (`hasPermission`)**
   - O endpoint exige especificamente `"manage_devices"`.
   - Verifica se a lista de permissões estáticas (`ROLE_PERMISSIONS[role]`) contém `"manage_devices"`.
   - Resultados possíveis: `ALLOW` (vai para próximo passo) ou `DENY` -> Throws `AuthError("Forbidden", 403)`.
   - **Nota importante**: Um erro `AuthError` devolução na API resulta de `{ "error": "Forbidden" }`, não devolve o literal `"ENTITLEMENT_DENIED"`.

3. **Domain Operations Setup (`pairDevice`)**
   - Recebe dados do frontend e id do tenant.

4. **Entitlement: Feature Gate Guard (`assertDevicesEnabled`)**
   - Avalia plano associado ao Tenant.
   - Verifica flag local `devices.enabled` e resolução no TenantPlan -> Plan -> EntitlementDefinition.
   - Resultados possíveis: `ALLOW` ou `DENY`. Se `DENY` -> Throws `EntitlementDeniedError` que mapeia para HTTP 403 `{ "error": "ENTITLEMENT_DENIED" }`.

5. **Entitlement: Quota Guard (`assertDevicesMaxAllocation`)**
   - Avalia o limite numérico (ex: `devices.max = 5`).
   - Conta Ecrãs activos.
   - Resultados possíveis: `ALLOW` ou `DENY`. Se `DENY` -> Throws `EntitlementDeniedError` com flag específica que mapeia para HTTP 403 `{ "error": "QUOTA_EXCEEDED" }`.

6. **Final Decision**
   - Ecrã Criado. Devolve `{ "paired": true }`.

---

## O Caso Observado ("O BUG")

A afirmação base: "SUPER_ADMIN consegue adicionar, mas os outros perfis recebem a mensagem UI: ENTITLEMENT_DENIED".

Porquê que isto acontece?

Vamos olhar para a forma como o Frontend interpreta erros da API.
No frontend (conforme observado na pesquisa à base de código e em handlers de erro como `src/features/media/direct-upload.ts`):
Se a API devolver o literal `ENTITLEMENT_DENIED`, o UI sabe o que é. Mas de onde vêm estes erros para Utilizadores como `ADMIN` ou `OPERATOR`?

**Hipótese A:** O Entitlement é avaliado usando a identidade do Utilizador.
- **FALSO**: As funções de verificação de Entitlements (`assertDevicesEnabled`, `resolveEffectiveEntitlements`) apenas recebem `tenantId`. Eles são agnósticos de quem é o invocador e não utilizam perfis nem papéis RBAC na lógica interna. Logo, o resultado do Entitlement é estritamente igual para qualquer perfil. A camada que faz distinção entre SUPER_ADMIN e ADMIN/OPERATOR é APENAS O RBAC.

**Hipótese B:** Um perfil falha no RBAC (403 Forbidden), e o componente UI está a assumir ou a mapear erradamente as respostas HTTP 403 gerais como `ENTITLEMENT_DENIED`!
- Se um utilizador não tem a permissão `manage_devices`, e submeter o formulário de pair, a API rejeita na primeira linha: `requireSession("manage_devices")` com `403 Forbidden`. Se a função que chama a API (ex. action de servidor, fetch na web) mapear todos os códigos de erro HTTP 403 para a chave UI "ENTITLEMENT_DENIED" como generic catch-all, então explica o comportamento observado.
- O problema disto é que os perfis que podem fazer `manage_devices` (segundo a matriz) são: `SUPER_ADMIN`, `ADMIN` e `OPERATOR`.
- O que acontece quando o Perfil = `EDITOR` tenta aceder? O Editor não tem "manage_devices". O UI renderiza o botão? Se o componente UI estiver desprotegido (sem `requirePermission` de UI), o botão aparece, mas a chamada falha no `requireSession` da API. Se isso der 403 genérico e for interpretado de forma errada, aparece na notificação o `ENTITLEMENT_DENIED`.
- E se o Perfil for `ADMIN` e não funciona? Nesse caso o Admin tem `manage_devices`. O RBAC passaria. Mas os Entitlements também passariam (tal como passam para o SUPER_ADMIN). Se `ADMIN` falha por causa do Entitlement, então ALGO (um bug) passaria um `tenantId` diferente ou a query é rejeitada por erro lógico na API (ex: `assertDevicesEnabled` a falhar porque não acha o Tenant). Mas não há distinção de perfis na camada de `services/entitlements.ts`.

**Conclusão da Análise de Fluxo:**
A camada de Entitlements (Plano, Quota) nunca discerne por função/role. Um "bypass" para SUPER_ADMIN não está codificado nas funções `assertDevicesEnabled` e `assertDevicesMaxAllocation`.

Assim, o problema aponta estritamente para um UI Error Mapping deficiente: um `403 Forbidden` (causado por falha no RBAC) está a ser confundido e exibido pela UI como `ENTITLEMENT_DENIED`. A solução passará por verificar e corrigir o Error Mapping.
