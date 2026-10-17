# Vitrine360 — Remediação RBAC P0/P1

| Campo | Valor |
|-------|--------|
| **Data** | 2026-10-17 |
| **Branch** | `security/rbac-p0-p1` |
| **Worktree** | `E:/PROJECTOS IA/UNILICUNGO/PROJECTOS FCT2026/Vitrine360-rbac-security` |
| **Base HEAD** | `9d4ee96e64d7e1d0859269f2ad9398132b21dde0` |
| **Árvore original** | `…/Vitrine360` em `main` — WIP **88** preservado (sem reset/clean) |
| **Auditoria de origem** | `docs/security/RBAC-MULTITENANCY-AUDIT.md` |
| **Commit / push** | Não realizados |
| **Production** | Inalterada (alias `vitrine360-psi` health → `environmentHint=production`, DB host Turso prod, bucket `vitrine360`) |
| **Deploy Preview** | Tentado via CLI — **`dpl_25Essba9…` / `vitrine360-6od8r6vhm-…` → `readyState=BLOCKED`** (team collaboration). Suite Preview **NOT RUN**. |

---

## 1. Isolamento do trabalho

| Decisão | Justificação |
|---------|--------------|
| Worktree novo a partir do HEAD | Preserva WIP no working tree original |
| Sem cópia indiscriminada do WIP | Achados F-01/F-03/F-05 existem no HEAD; F-02 também |
| WIP Drive/PoP **não** transferido | Independente da remediação P0/P1; evita misturar features |
| `node_modules` via junction para o tree original | Sem `npm install`; só execução de testes |

**Nota:** Rotas WIP (`src/app/api/admin/storage/**`, `device/pop`) **não** estão nesta branch. O inventário F-01 cobre o HEAD; ao integrar WIP, reexecutar `npm run test:rbac-guards`.

---

## 2. Achados e alterações

### F-01 — Fronteiras admin (ALTA / lacuna de garantia)

| Campo | Valor |
|-------|--------|
| **Estado** | **CORRIGIDO E TESTADO** (garantia estática; não é middleware global) |
| **Alteração** | Script `scripts/check-admin-route-guards.ts` — falha se `route.ts` admin/workspaces não referenciar `requireSession` / `getSession` / `authenticateDevice` / etc. |
| **npm** | `test:rbac-guards` |
| **Resultado** | 23/23 OK |
| **Não feito** | Middleware Next.js global (evitar rotas públicas/OAuth/player) |

### F-02 — Token em query string (MÉDIA)

| Campo | Valor |
|-------|--------|
| **Estado** | **CORRIGIDO MAS NÃO VALIDADO** em Preview; remediação **parcial** por compatibilidade |
| **Consumidores confirmados** | `playback-renderer-adapter.tsx`: `<video src>` **requer** `?token=` (Range HTTP); `fetch` já usa `Authorization: Bearer` |
| **Alteração** | Preferência documentada; trim do query token; header resposta `X-V360-Device-Auth: query\|header`; comentários F-02 no player |
| **Não feito** | Remoção de `?token=` (quebraria TV/video Range); signed URL de curta duração (fase futura) |
| **Risco residual** | Token ainda pode aparecer em logs/Referer quando o path query é usado |

### F-03 — `bumpPlaylistVersion` tenant opcional (MÉDIA)

| Campo | Valor |
|-------|--------|
| **Estado** | **CORRIGIDO E TESTADO** (local A-06) |
| **Alteração** | `tenantId: string` obrigatório; rejeita vazio; `WHERE` playlist + devices sempre com tenant |
| **Ficheiro** | `src/services/playlists.ts` |
| **Testes** | A06-PL-03..05, A06-DV-02 |

### F-04 — Matriz A-06 sem reexecução (MÉDIA)

| Campo | Valor |
|-------|--------|
| **Estado** | **CORRIGIDO E TESTADO** localmente; **Preview NOT RUN** |
| **Alteração** | Suite `scripts/test-rbac-cross-tenant-a06.ts` + `docs/security/RBAC-CROSS-TENANT-TEST-MATRIX.md` |
| **Local** | 16 PASS / 0 FAIL (`docs/security/RBAC-A06-LOCAL-RESULTS.json`) |
| **Preview** | Bloqueado até autorização de deploy / env isolado |

### F-05 — Disciplina cliente-tenant (MÉDIA)

| Campo | Valor |
|-------|--------|
| **Estado** | **CORRIGIDO E TESTADO** (estático) |
| **Alteração** | `scripts/check-admin-client-tenant.ts` — falha em `body.tenantId` / `workspaceId` em admin (allowlist: workspace switch) |
| **Resultado** | PASS; zero hits não allowlisted no HEAD |

---

## 3. Ficheiros afectados (worktree)

| Ficheiro | Tipo |
|----------|------|
| `src/services/playlists.ts` | F-03 |
| `src/app/api/device/media/[assetId]/route.ts` | F-02 |
| `src/player/playback/playback-renderer-adapter.tsx` | F-02 comentário |
| `scripts/check-admin-route-guards.ts` | F-01 |
| `scripts/check-admin-client-tenant.ts` | F-05 |
| `scripts/test-rbac-cross-tenant-a06.ts` | F-04 / A-06 |
| `package.json` | scripts npm |
| `docs/security/*` | documentação + evidencia local |

---

## 4. Testes executados

| Suite | Ambiente | PASS | FAIL | BLOCKED | NOT RUN |
|-------|----------|------|------|---------|---------|
| `test:rbac-guards` | local worktree | 2 scripts | 0 | — | — |
| `test:rbac-a06` | `file:./data/rbac-a06-test.db` | 16 | 0 | — | — |
| `test:rbac` (workspace) | mesma DB isolada | 1 | 0 | — | — |
| `test:tenant` | mesma DB isolada | 1 | 0 | — | — |
| A-06 HTTP live Preview | Preview isolado | — | — | deploy | **NOT RUN** |
| authz-device-02 e2e browser | local/Preview | — | — | — | **NOT RUN** (credenciais/browser) |
| ACL R2 bucket | cloud | — | — | sem acesso auth | **NOT RUN** |

**Mutações de dados:** apenas na DB ficheiro local `rbac-a06-test.db` (sintéticos). Sem mutação de dados reais / Production / Preview partilhado.

---

## 5. Cross-tenant — efeitos nos dados de teste

| Caso | HTTP/serviço | Estado dos dados |
|------|--------------|------------------|
| update/delete content tenant B → id de A | reject | título/registo A inalterado |
| bump playlist A com tenant B | no-op | version A inalterada |
| bump playlist A com tenant A | ok | version +1; manifest device A +1 |
| assign playlist B a device A | reject | assignment não aplicado |
| media asset B filtrado com tenant A | 0 rows | sem leitura |

---

## 6. Itens não verificáveis

| Item | Motivo |
|------|--------|
| ACLs R2 reais | Sem acesso autorizado à config do bucket nesta fase |
| Preview deployment desta branch | Deploy/env exige autorização explícita (secção 7 pedido) |
| Rotas WIP Drive/PoP | Fora do worktree HEAD |
| Cobertura CRUD 100% de todos os serviços | Inventário parcial; suite A-06 cobre sample crítico |
| Jobs async genéricos | Sem superfície dedicada no HEAD |

---

## 7. Fase D — Deployment Preview (2026-10-17)

### Pré-condições (antes do deploy)

| Check | Resultado |
|-------|-----------|
| Worktree = `security/rbac-p0-p1` @ `9d4ee96` | PASS |
| WIP original | **88** intacto |
| Suites locais reexecutadas | `test:rbac-guards` PASS; `test:rbac-a06` 16/16 PASS |
| Migrations novas nesta remediação | **Nenhuma** (só código/scripts/docs) |
| Env Preview vs Production | Chaves separadas por `target` (`DATABASE_URL`, `TURSO_*`, `R2_*`, `AUTH_SECRET`, …). Valores **não** impressos |
| Ligação acidental a Production no deploy CLI | Deploy sem `--prod`; target observado = **preview** |

### Deployment criado

| Campo | Valor |
|-------|--------|
| ID | `dpl_25Essba9TcEYweu8ZTaDVRjyjD57` |
| URL | `https://vitrine360-6od8r6vhm-egaslemos-5751s-projects.vercel.app` |
| Inspect | `https://vercel.com/egaslemos-5751s-projects/vitrine360/25Essba9TcEYweu8ZTaDVRjyjD57` |
| Source | CLI (`vercel deploy --yes`, sem push) |
| Target | preview (não production) |
| **readyState** | **BLOCKED** |
| errorLink | `https://vercel.com/docs/deployments/troubleshoot-project-collaboration#team-configuration` |
| Build logs | Vazios (evento list vazio) |
| Aliases alterados | **Não** (`alias: []`; `vitrine360-psi` permanece Production) |

### Validação HTTP / A-06 no Preview

**NOT RUN** — deployment não READY. Critério de interrupção: ambiente não utilizável / dúvida sobre artefacto.

### Pedido de autorização (desbloqueio)

Para completar a Fase D, autorizar **uma** das opções:

1. **Commit + push** da branch `security/rbac-p0-p1` para o remoto (Git integration costuma produzir Preview READY), **ou**
2. **Desbloqueio manual** do deployment CLI `dpl_25Essba9…` no dashboard Vercel (team collaboration / trusted publishers), **ou**
3. Autorização explícita para outro mecanismo de deploy aprovado pela equipa.

Até lá: **validação Preview = SUSPENSA**.

---

## 8. Estado dos achados (pós tentativa Preview)

| Achado | Estado |
|--------|--------|
| F-01 | CORRIGIDO MAS NÃO VALIDADO (no Preview) — local CORRIGIDO E TESTADO |
| F-02 | CORRIGIDO MAS NÃO VALIDADO — `?token=` residual documentado |
| F-03 | CORRIGIDO MAS NÃO VALIDADO (no Preview) — local CORRIGIDO E TESTADO |
| F-04 | PENDENTE no Preview — local 16/16 PASS |
| F-05 | CORRIGIDO MAS NÃO VALIDADO (no Preview) — local CORRIGIDO E TESTADO |
| ACL R2 | NÃO VERIFICÁVEL / NOT RUN |
| Drive/PoP WIP | Fora de cobertura (não na branch) |

Nenhum achado classificado **CORRIGIDO E VALIDADO NO PREVIEW**.

---

## 9. Recomendação

| Pergunta | Resposta |
|----------|----------|
| Continuar validação Preview? | **Suspensa** até desbloqueio (secção 7) |
| Falha de isolamento confirmada? | Não |
| Aliases / Production alterados? | **Não** |
| Lançamento geral? | **Não autorizado** |
| Próximo passo | Autorizar commit+push **ou** desbloqueio Vercel do CLI deploy |

---

## 10. Git (fecho desta sessão)

```
branch: security/rbac-p0-p1
HEAD:   9d4ee96 (remediações ainda uncommitted no worktree)
WIP original (main): 88 — preservado
commit/push: não
```
