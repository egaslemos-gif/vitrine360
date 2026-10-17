# Vitrine360 — Auditoria RBAC e Isolamento Multi-Tenant

| Campo | Valor |
|-------|--------|
| **Data** | 2026-10-17 |
| **Tipo** | Análise estática / read-only |
| **HEAD auditado** | `9d4ee96e64d7e1d0859269f2ad9398132b21dde0` |
| **Repositório** | `E:/PROJECTOS IA/UNILICUNGO/PROJECTOS FCT2026/Vitrine360` |
| **WIP no início** | 87 entradas `git status --short` (preservado) |
| **Produção** | Não acedida |
| **Correcções** | Nenhuma (fora de âmbito) |

---

## 1. Resumo executivo

O modelo de autorização observado é **tenant-scoped + membership-resolved**: o JWT de sessão carrega `role`/`tenantId`, mas `getSession()` **não confia** nesses claims — revalida membership `ACTIVE`, tenant operável e role a partir da base de dados. As rotas admin amostradas passam `session.tenantId` / `session.activeTenantId` aos serviços; o cliente não fornece o tenant efectivo de autorização. Media (admin e device) e Proof-of-Play filtram por tenant do autenticado.

**Não foi confirmada, nesta auditoria estática, uma vulnerabilidade de leitura/escrita cross-tenant activa** nas superfícies principais inspecionadas. Existem, contudo, **riscos residuais e lacunas de cobertura** (token em query string, helper de playlist sem tenant obrigatório, ausência de middleware global, RBAC profundo A-06 NOT TESTED em Preview).

| Severidade | Nº de achados |
|------------|---------------|
| CRÍTICA | 0 |
| ALTA | 1 |
| MÉDIA | 4 |
| BAIXA | 2 |
| INFORMATIVA | 3 |

**Vulnerabilidades confirmadas (exploráveis):** nenhuma classificada como CRÍTICA/ALTA com exploração demonstrada só por leitura. O achado ALTA é uma **lacuna de garantia** (cobertura de testes / ausência de gate global), não uma falha de bypass comprovada no código amostrado.

---

## 2. Âmbito e exclusões

### Incluído
- Autenticação/sessão (`src/lib/auth.ts`, `src/lib/admin-access.ts`)
- Domínio de roles/permissions (`src/domain/types.ts`)
- Memberships e workspace switch
- Rotas `src/app/api/admin/**` (amostra completa de `requireSession` + `session.tenantId`)
- Media: `/api/media/[...key]`, `/api/device/media/[assetId]`
- PoP: `/api/device/pop`
- Drive OAuth por tenant (connect/callback/status/disconnect/folder)
- Schema Drizzle (índices/constraints `tenant_id`)
- Evidência documental authz (`docs/evidence/authz-device-*`, platform-identity)
- Scripts de teste com menções a isolamento (inventário, sem execução)

### Excluído / não autorizado
- Alteração de código, dados, schemas, env, migrations
- Testes contra Production ou Preview que mutem dados
- Bypass activo de controlos, uso de credenciais de terceiros
- Penetration test dinâmico, fuzzing, força bruta
- Revisão completa linha-a-linha de todos os Server Components / UI gates
- Auditoria de ACLs do bucket R2 em cloud (infra externa)

---

## 3. Arquitectura de autenticação e autorização observada

```
Cliente (cookie v360_session | Bearer device)
        │
        ▼
  jwtVerify (AUTH_SECRET)
        │
        ▼
  getSession() ──► users by sub
               ──► resolveActiveMembership(userId, claimedTenant)
               ──► status === ACTIVE
               ──► isTenantOperable(tenantId)
               ──► role = membershipRole(membership)  // JWT role ignorado
        │
        ▼
  requireSession(permission?) ──► hasPermission(role, permission)
        │
        ▼
  Handlers admin ──► services.*(…, session.tenantId, …)
  Device routes ──► authenticateDevice(Authorization) → device.tenantId
```

| Componente | Localização | Comportamento observado |
|------------|-------------|-------------------------|
| Cookie sessão | `src/lib/auth.ts` (`SESSION_COOKIE = v360_session`) | httpOnly, SameSite=lax, TTL 12h |
| JWT claims | `createSessionToken` | `sub`, email, name, role, tenantId, activeTenantId |
| Autoridade efectiva | `getSession` L100–141 | Role e tenant vindos da membership DB |
| Gate API | `requireSession` L151–161 | 401 sem sessão; 403 sem tenant ou sem permission |
| Gate página | `src/lib/admin-access.ts` `requireAdminPage` | redirect login / AccessDenied |
| Device auth | `authenticateDevice` em `src/services/devices.ts` | Bearer → device + tenantId |
| Middleware Next | **Ausente** (`middleware.ts` não existe) | Auth por handler |

**Platform dual-axis** (`platform_assignments`, flag): documentado como aditivo e não substituto do gate tenant (`docs/evidence/platform-identity-05a/CURRENT-AUTHZ-AUDIT.md`). Não altera o isolamento tenant quando a flag está OFF.

---

## 4. Modelo de tenant e membership

| Entidade | Schema (resumo) | Notas |
|----------|-----------------|-------|
| `tenants` | PK id, slug, lifecycle | Operabilidade via `isTenantOperable` |
| `users` | `tenant_id` + email unique por tenant | Home tenant; auth efectiva é membership |
| `memberships` | `(user_id, tenant_id)` unique; role; status | ACTIVE / INVITED / SUSPENDED |
| Recursos (devices, media, contents, playlists, schedules, …) | `tenant_id` + índices | Filtro esperado nas queries de serviço |
| `tenant_storage_configs` | 1:1 por tenant | Drive OAuth tokens por tenant |
| `proof_of_play_events` | tenant_id + device_id | Comentário schema: nunca do body cliente |

**Roles e permissões** (`src/domain/types.ts` L23–41):

| Role | Permissões |
|------|------------|
| SUPER_ADMIN | Todas (`PERMISSIONS`) |
| ADMIN | Todas (equivalente a SUPER_ADMIN neste catálogo) |
| EDITOR | contents, playlists, schedules, view_dashboard, view_logs |
| OPERATOR | devices, playlists, schedules, view_dashboard, view_logs |
| VIEWER | view_dashboard, view_logs |

**Workspace switch** (`src/app/api/workspaces/switch/route.ts` L13–29): exige membership ACTIVE no `tenantId` do body; rejeita tenant não operável; reemite cookie com sessão rederivada.

**Drive OAuth** (`connect` L31–34; `callback` L61–68): transaction assina `tenantId`+`userId`; callback exige `session.id === tx.userId` e `session.tenantId === tx.tenantId`.

---

## 5. Matriz de superfícies auditadas

| Superfície | Auth | Tenant source | Isolamento observado | Estado |
|------------|------|---------------|----------------------|--------|
| Admin CRUD contents/playlists/schedules/media/devices | `requireSession(permission)` | `session.tenantId` | Serviços com filtro tenant (amostra) | Controlos presentes |
| Admin users/members | `manage_users` | `activeTenantId` | List/create scoped | Controlos presentes |
| Workspace switch | `requireSession()` | body + membership check | 403 se sem membership | Controlo presente |
| `/api/media/[...key]` | session **ou** device Bearer | `allowedTenantId` + `eq(mediaAssets.tenantId)` | 401 sem auth; 404 cross-tenant | Controlo presente |
| `/api/device/media/[assetId]` | Bearer **ou** `?token=` | `device.tenantId` + asset tenant | 404 cross-tenant | Controlo + risco token query |
| `/api/device/pop` | Bearer | `device.tenantId` (body.tenantId ignorado) | Isolamento por design | Controlo presente |
| Drive connect/callback | session / OAuth cookie | session ↔ tx | Mismatch → redirect erro | Controlo presente |
| R2 object ACLs | N/A código | keys `tenantId/…` (comentário r2-provider) | ACLs cloud **não verificáveis** aqui | NÃO VERIFICÁVEL |
| UI-only gates | `requireAdminPage` | session | Bypass via API directa possível se rota falhar | Depende de cada rota |
| Tarefas async / sync jobs | — | — | Sem worker dedicado de sync cross-tenant no âmbito | NÃO VERIFICÁVEL / N/A parcial |

---

## 6. Achados classificados por severidade

### F-01 — ALTA — Ausência de middleware global + dependência de disciplina por rota

| Campo | Valor |
|-------|--------|
| **ID** | F-01 |
| **Severidade** | ALTA |
| **Componente** | Fronteira HTTP / `src/app/api/**` |
| **Evidência** | Não existe `middleware.ts` no repositório. Autorização depende de cada `route.ts` chamar `requireSession` / `authenticateDevice`. Amostra: todas as rotas admin listadas em §5 chamam `requireSession`, mas **não há prova automática** de que rotas futuras ou Server Actions omitam o gate. |
| **Cenário de ameaça** | 8, 13 (operação privilegiada só na UI; rota nova sem gate) |
| **Impacto** | Uma rota esquecida pode expor CRUD ou dados multi-tenant sem permission check. |
| **Estado** | **PARCIAL** — padrão actual parece consistente; garantia incompleta (sem inventário formal + testes de regressão por rota). |
| **Recomendação** | Inventário CI de handlers sem `requireSession`/`authenticateDevice`; considerar middleware deny-by-default para `/api/admin/*`; checklist em PR. |
| **Teste necessário** | Script estático que falhe se `export async function (GET\|POST\|…)` em `api/admin` não referenciar `requireSession` (excepto allowlist explícita, ex. OAuth callback). |

---

### F-02 — MÉDIA — Token de dispositivo aceito em query string

| Campo | Valor |
|-------|--------|
| **ID** | F-02 |
| **Severidade** | MÉDIA |
| **Componente** | `src/app/api/device/media/[assetId]/route.ts` L89–94 |
| **Evidência** | `const tokenParam = req.nextUrl.searchParams.get("token");` + `Bearer ${tokenParam}`. Isolamento por `device.tenantId` mantém-se (L98–105), mas o segredo pode vazar via logs de proxy, Referer, histórico, analytics. |
| **Cenário de ameaça** | 7, 9, 10 |
| **Impacto** | Compromisso do Bearer de um device → leitura de media desse tenant (não de outro, se o filtro tenant permanecer). |
| **Estado** | **CONFIRMADO** (comportimento de risco; não é bypass cross-tenant por si). |
| **Recomendação** | Preferir só header `Authorization`; se query for necessária para media elements legados, tokens de curta duração / signed URL scoped ao asset. |
| **Teste** | Verificar que media playback funciona só com header; auditar logs Preview/CDN sem `?token=`. |

---

### F-03 — MÉDIA — `bumpPlaylistVersion` com `tenantId` opcional

| Campo | Valor |
|-------|--------|
| **ID** | F-03 |
| **Severidade** | MÉDIA |
| **Componente** | `src/services/playlists.ts` L343–378 |
| **Evidência** | Assinatura `tenantId?: string`. Se omitido, `WHERE` usa só `playlists.id`. Depois actualiza **todos** os `devices` com `currentPlaylistId = playlistId` sem filtro de tenant (L365–378). Call sites observados passam `tenantId`, mas a API interna permite omissão. |
| **Cenário de ameaça** | 6, 11 |
| **Impacto** | Footgun: chamada futura sem tenant pode bump/versionar playlist e dispositivos errados se IDs colidirem ou forem reutilizados incorrectamente. |
| **Estado** | **PARCIAL** — risco de desenho; exploração actual não demonstrada (call sites passam tenant). |
| **Recomendação** | Tornar `tenantId` obrigatório; incluir `eq(devices.tenantId, tenantId)` no update em cascata. |
| **Teste** | Unit test: bump sem tenantId deve falhar tipo/runtime; bump com tenant errado → no-op. |

---

### F-04 — MÉDIA — Cobertura RBAC profundo / cross-tenant live incompleta

| Campo | Valor |
|-------|--------|
| **ID** | F-04 |
| **Severidade** | MÉDIA |
| **Componente** | Validação / piloto |
| **Evidência** | `docs/pilot/PILOT-CLOSURE-ASSESSMENT.md`: A-06 RBAC profundo **NOT TESTED**; cross-tenant live com dados reais limitado; suites históricas em `docs/evidence/authz-device-01/02` e scripts (`test-drive-mt-phase2-2.ts` ROUTE-02, `smoke-proof-of-play.ts`) existem mas **não foram reexecutados** nesta auditoria. |
| **Cenário de ameaça** | 1–6, 8 |
| **Impacto** | Controlos no código podem regressar sem detecção antes de lançamento geral. |
| **Estado** | **CONFIRMADO** (lacuna de evidência operacional, não falha de código). |
| **Recomendação** | Suite isolada Preview com dois tenants, roles VIEWER/EDITOR/OPERATOR/ADMIN, matrix deny/allow. |
| **Teste** | Matriz A-06 em ambiente isolado (ver §11). |

---

### F-05 — MÉDIA — Confiança em disciplina de serviço + UI vs API

| Campo | Valor |
|-------|--------|
| **ID** | F-05 |
| **Severidade** | MÉDIA |
| **Componente** | Camada serviços / páginas admin |
| **Evidência** | Páginas usam `requireAdminPage`; APIs usam `requireSession`. Amostra de rotas admin passa `session.tenantId`. Não foi feita prova formal de que **nenhuma** função de serviço pública aceite `tenantId` do cliente sem revalidação. Padrão dominante: tenant da sessão. |
| **Cenário de ameaça** | 3, 4, 13 |
| **Impacto** | Se uma rota futura aceitar `body.tenantId` sem membership, isolamento quebra. |
| **Estado** | **PARCIAL** — padrão bom na amostra; risco residual de regressão. |
| **Recomendação** | Convenção: nunca aceitar `tenantId` do cliente em admin APIs; lint/rg gate em CI. |
| **Teste** | Grep CI: `body.tenantId` / `params.tenantId` em `api/admin` sem allowlist. |

---

### F-06 — BAIXA — SUPER_ADMIN ≡ ADMIN no catálogo de permissões tenant

| Campo | Valor |
|-------|--------|
| **ID** | F-06 |
| **Severidade** | BAIXA |
| **Componente** | `src/domain/types.ts` L23–25 |
| **Evidência** | Ambos mapeiam para `PERMISSIONS` completo. Distinção apenas pontual (ex. criar SUPER_ADMIN em `users/route.ts` L39–41). |
| **Cenário de ameaça** | 8, 14 |
| **Impacto** | Expectativa de “super” privilegiado global pode ser falsa; ou ADMIN ter poderes indesejados se se assumir hierarquia. |
| **Estado** | **CONFIRMADO** (desenho, não bypass). |
| **Recomendação** | Documentar equivalência; ou separar permissões platform vs tenant. |
| **Teste** | Casos ADMIN vs SUPER_ADMIN em gestão de roles. |

---

### F-07 — BAIXA — VIEWER com `view_dashboard` vê observabilidade de devices

| Campo | Valor |
|-------|--------|
| **ID** | F-07 |
| **Severidade** | BAIXA |
| **Componente** | `ROLE_PERMISSIONS.VIEWER` + rotas devices GET com `view_dashboard` |
| **Evidência** | VIEWER tem `view_dashboard`/`view_logs`; presença/listagem de devices no tenant pode ser legível conforme rotas que usam essa permission. |
| **Cenário de ameaça** | 8 |
| **Impacto** | Exposição interna de metadados de devices a roles “read-only” — pode ser intencional. |
| **Estado** | **PARCIAL** — comportamento de produto; confirmar se alinhado com política. |
| **Recomendação** | Confirmar política de produto; restringir se VIEWER não deve ver devices. |
| **Teste** | Login VIEWER → GET `/api/admin/devices` esperado 200 ou 403 conforme política. |

---

### F-08 — INFORMATIVA — Revalidação de membership (controlo positivo)

| Campo | Valor |
|-------|--------|
| **ID** | F-08 |
| **Severidade** | INFORMATIVA |
| **Componente** | `getSession` |
| **Evidência** | L117–137: membership ACTIVE + role DB; JWT role não autoritativo. |
| **Cenário** | 2, 14 |
| **Estado** | Controlo **CONFIRMADO** |
| **Recomendação** | Manter; não confiar em claims assinados para authz. |

---

### F-09 — INFORMATIVA — PoP e media filtram por tenant do autenticado

| Campo | Valor |
|-------|--------|
| **ID** | F-09 |
| **Severidade** | INFORMATIVA |
| **Componente** | `device/pop`, `media/[...key]`, `device/media` |
| **Evidência** | PoP L21–22, L61–64; media L45–66; device-media L98–105. |
| **Cenário** | 1, 3, 9 |
| **Estado** | Controlo **CONFIRMADO** (estático) |
| **Recomendação** | Manter; reforçar com testes cross-tenant automatizados. |

---

### F-10 — INFORMATIVA — Drive OAuth amarra sessão ↔ transaction

| Campo | Valor |
|-------|--------|
| **ID** | F-10 |
| **Severidade** | INFORMATIVA |
| **Componente** | `storage/drive/callback` L61–68 |
| **Evidência** | `session_mismatch` se user/tenant ≠ tx. |
| **Cenário** | 10, 11 |
| **Estado** | Controlo **CONFIRMADO** |
| **Recomendação** | Manter; não logar códigos/tokens (já comentado L80–81). |

---

## 7. Evidências com caminhos e linhas

| Tema | Ficheiro | Linhas (aprox.) |
|------|----------|-----------------|
| Revalidação sessão | `src/lib/auth.ts` | 100–161 |
| ROLE_PERMISSIONS | `src/domain/types.ts` | 12–45 |
| Membership resolve | `src/services/memberships.ts` | 48–61 |
| Workspace switch | `src/app/api/workspaces/switch/route.ts` | 13–29 |
| Media auth+tenant | `src/app/api/media/[...key]/route.ts` | 21–71 |
| Device media + `?token=` | `src/app/api/device/media/[assetId]/route.ts` | 89–105 |
| PoP ignora body tenant | `src/app/api/device/pop/route.ts` | 21–65 |
| Drive connect tenant | `src/app/api/admin/storage/drive/connect/route.ts` | 16–34 |
| Drive callback match | `src/app/api/admin/storage/drive/callback/route.ts` | 61–68 |
| bumpPlaylistVersion | `src/services/playlists.ts` | 343–378 |
| Users SUPER_ADMIN gate | `src/app/api/admin/users/route.ts` | 18–41 |
| Schema tenant indexes | `src/db/schema.ts` | memberships, media_assets, pop comments |
| Authz histórica | `docs/evidence/authz-device-01/*`, `authz-device-02/*` | — |
| A-06 NOT TESTED | `docs/pilot/PILOT-CLOSURE-ASSESSMENT.md` | § autenticação / 15b |

---

## 8. Matriz de cenários de ameaça

| # | Cenário | Resultado da auditoria |
|---|---------|------------------------|
| 1 | User acede recurso doutro tenant | **Parcialmente confirmado protegido** (filtros tenant nas rotas amostradas); validação live A-06 **não verificável** aqui |
| 2 | Tamper IDs URL/body | **Parcial** — IDs de recurso + `session.tenantId` nas mutações amostradas; 404 esperado se ID alheio |
| 3 | API aceita `tenant_id` cliente sem membership | **Não encontrado** nas rotas admin amostradas (tenant da sessão). PoP ignora body. Workspace switch **verifica** membership |
| 4 | Validação só na UI | **Parcial** — APIs têm gates; risco se rota nova omitir (F-01) |
| 5 | Listagens sem filtro tenant | **Não encontrado** na amostra (dashboard/list* com `session.tenantId`) |
| 6 | Update/delete cross-tenant | **Parcial** — serviços recebem tenant; F-03 footgun em bump |
| 7 | ID previsível | **Parcial** — UUIDs; token query (F-02) é o vector mais concreto |
| 8 | Role limitada → admin op | **Parcial** — `hasPermission` nas rotas; equivalência SUPER/ADMIN (F-06); A-06 NOT TESTED |
| 9 | Media sem authz | **Protegido na amostra** (`/api/media` 401; device-media auth+tenant) |
| 10 | Credenciais tenant A → tenant B | **Parcialmente protegido** (Drive callback; device token scoped); R2 ACLs **não verificável** |
| 11 | Async perde contexto tenant | **Não verificável** / N/A parcial (sem job sync genérico auditado) |
| 12 | Endpoints públicos expõem internos | **Parcial** — media pública negada; health/outros não auditados em profundidade |
| 13 | Privilegiado só na UI | **Parcial** — APIs gated; F-01 |
| 14 | Ausência membership → permissões excessivas | **Protegido** — `getSession` null sem membership ACTIVE; `requireSession` 403 sem tenant |

---

## 9. Matriz de cobertura dos testes existentes (inventário estático)

| Suite / evidência | Isolamento / RBAC | Executado nesta auditoria? |
|-------------------|-------------------|----------------------------|
| `docs/evidence/authz-device-01` | Role matrix, device API | Não |
| `docs/evidence/authz-device-02` | Browser/e2e roles, entitlements | Não |
| `scripts/authz02-e2e-*.ts` | E2E local DB | Não |
| `scripts/test-drive-mt-phase2-2.ts` | ROUTE-02 cross-tenant device media | Não |
| `scripts/smoke-proof-of-play.ts` | Cross-tenant content reject | Não |
| `scripts/test-schedule-management-02b.ts` | SCHED-MGMT-015..018 | Não |
| `scripts/test-platform-identity-10o.ts` | Phase Q tenant isolation | Não |
| Piloto A-06 | RBAC profundo Preview | **NOT TESTED** (doc) |

**Conclusão de cobertura:** existem testes históricos e scripts WIP relevantes; **não há evidência reexecutada neste HEAD** que feche A-06 para lançamento.

---

## 10. Plano de remediação priorizado

| Prioridade | Achado | Acção | Esforço |
|------------|--------|-------|---------|
| P0 | F-01 | Inventário CI + deny-by-default `/api/admin` | M |
| P0 | F-04 | Reexecutar matriz RBAC/cross-tenant em Preview isolado | M |
| P1 | F-02 | Remover ou limitar `?token=`; signed URLs | M |
| P1 | F-03 | `tenantId` obrigatório + filtro devices | S |
| P2 | F-05 | Lint/rg contra `tenantId` do cliente em admin | S |
| P2 | F-06/F-07 | Alinhar política de roles com produto | S |
| P3 | R2 ACLs | Verificar bucket privado + signed GET | M (ops) |

**Nenhuma correcção aplicada nesta fase.**

---

## 11. Plano de validação futura (ambiente isolado)

1. Dois tenants (A/B), users VIEWER/EDITOR/OPERATOR/ADMIN em cada um.
2. Para cada recurso (content, playlist, media, device, schedule): CRUD com session A sobre IDs de B → esperar 403/404.
3. Device Bearer A → media asset B → 404.
4. PoP body com `tenantId` de B → eventos gravados só sob tenant do device.
5. Workspace switch para tenant sem membership → 403.
6. Drive connect: trocar cookie/tx entre users → `session_mismatch`.
7. Role matrix: EDITOR sem `manage_users` / `manage_devices`; OPERATOR sem `manage_contents`.
8. Sem `?token=` (ou token expirado) → 401 em device-media.
9. **Não** usar Production; DB Preview dedicada ou local Turso file.

---

## 12. Critérios de saída para futura avaliação de segurança

- [ ] Zero rotas `api/admin` sem gate (CI verde)
- [ ] Matriz A-06 PASS em Preview isolado com evidência datada
- [ ] Cross-tenant media/PoP/playlist PASS documentado neste HEAD (ou posterior)
- [ ] `bumpPlaylistVersion` com tenant obrigatório (se remediado) + testes
- [ ] Política de `?token=` documentada ou removida
- [ ] R2/Drive: confirmação de que object storage não é listável publicamente
- [ ] Sem achados CRÍTICA/ALTA abertos classificados como vulnerabilidade explorável

---

## 13. Limitações desta auditoria

- Apenas análise estática; **nenhum teste dinâmico** executado.
- Amostra de rotas admin completa para `requireSession`, mas **não** prova formal de cada linha de cada serviço CRUD.
- WIP inclui código Drive/PoP **não necessariamente** no commit HEAD `9d4ee96` (working tree); a auditoria reflecte o **working tree + HEAD** conforme ficheiros presentes.
- ACLs cloud (R2), CDN logs, e Production **fora de âmbito**.
- Ausência de falha encontrada **não** equivale a “seguro para lançamento geral”.
- Platform authz dual-axis não foi re-auditada em profundidade além da evidência 05a.

---

## 14. Verificação Git (fecho)

| Check | Resultado |
|-------|-----------|
| HEAD inicial | `9d4ee96…` |
| WIP inicial | 87 |
| Alteração desta tarefa | Apenas `docs/security/RBAC-MULTITENANCY-AUDIT.md` (novo) |
| Código app / env / migrations / Production | Não alterados por esta tarefa |
| Commit / push | Não realizados |

*(Reconfirmar com `git status` após criação do ficheiro.)*

---

## 15. Conclusão

O isolamento multi-tenant **parece intencional e coerente** nas fronteiras críticas (sessão membership-resolved, admin com tenant de sessão, media e PoP com tenant do autenticado, Drive OAuth amarrado). Os principais riscos residuais são **garantia operacional** (F-01, F-04), **higiene de secrets em URL** (F-02) e **footguns de API interna** (F-03), não um bypass cross-tenant confirmado por leitura.

**Próxima etapa recomendada:** remediação P0/P1 em branch dedicada + suite A-06 em Preview isolado — **sem** promover Production.

---

## 16. Estado pós-remediação (2026-10-17) — branch `security/rbac-p0-p1`

Secção **aditiva**. O texto das secções 1–15 permanece o registo da auditoria estática original.

| Achado | Estado remediação | Evidência |
|--------|-------------------|-----------|
| F-01 | CORRIGIDO E TESTADO (guards estáticos; sem middleware global) | `npm run test:rbac-guards` |
| F-02 | CORRIGIDO MAS NÃO VALIDADO (parcial — `?token=` mantido por `<video src>`) | device-media + comentário player |
| F-03 | CORRIGIDO E TESTADO | `bumpPlaylistVersion` + A06-PL-03..05 |
| F-04 | CORRIGIDO E TESTADO local; Preview NOT RUN | `RBAC-A06-LOCAL-RESULTS.json` (16 PASS) |
| F-05 | CORRIGIDO E TESTADO (estático) | `check-admin-client-tenant.ts` |

Relatórios: `RBAC-REMEDIATION-REPORT.md`, `RBAC-CROSS-TENANT-TEST-MATRIX.md`.

**Não** converter PASS local em alegação de segurança Preview/Production demonstrada.
