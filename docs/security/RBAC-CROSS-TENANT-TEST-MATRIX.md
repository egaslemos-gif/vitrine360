# Matriz A-06 / Cross-Tenant — RBAC Security

| Campo | Valor |
|-------|--------|
| **Data** | 2026-10-17 |
| **Branch** | `security/rbac-p0-p1` |
| **Referência piloto A-06** | `docs/pilot/PILOT-ACCEPTANCE.md` — «Autorização RBAC completa no piloto» (NOT TESTED na estabilização) |
| **Suite local** | `npm run test:rbac-a06` com `DATABASE_URL=file:./data/rbac-a06-test.db` |
| **Evidência local** | `docs/security/RBAC-A06-LOCAL-RESULTS.json` |

Estados: `PASS` · `FAIL` · `BLOCKED` · `NOT RUN`

---

## 1. Casos da suite local (`test-rbac-cross-tenant-a06.ts`)

| ID | Cenário (pedido §5) | Resultado local | Efeito dados |
|----|---------------------|-----------------|--------------|
| A06-ROLE-01 | Role VIEWER sem manage_users/devices/contents | **PASS** | N/A |
| A06-ROLE-02 | EDITOR sem manage_devices/users | **PASS** | N/A |
| A06-ROLE-03 | OPERATOR sem manage_contents/users | **PASS** | N/A |
| A06-CT-01 | Listagem contents A vs B | **PASS** | Sem leak |
| A06-CT-02 | Update content A com tenant B | **PASS** | Título A inalterado |
| A06-CT-03 | Delete content A com tenant B | **PASS** | Registo A permanece |
| A06-PL-01 | List playlists isolamento | **PASS** | Sem leak |
| A06-PL-02 | Delete playlist A com tenant B | **PASS** | Playlist A permanece |
| A06-PL-03 | bumpPlaylistVersion sem tenant / vazio | **PASS** | reject |
| A06-PL-04 | bump playlist A com tenant B | **PASS** | version inalterada |
| A06-PL-05 | bump playlist A com tenant A | **PASS** | version +1 |
| A06-DV-01 | Assign playlist B → device A | **PASS** | reject |
| A06-DV-02 | bump atualiza manifest só no tenant | **PASS** | manifest +1 |
| A06-PL-06 | Attach content B → playlist A | **PASS** | reject |
| A06-MD-01 | mediaAssets filtro tenant | **PASS** | 0 rows cross |
| A06-RBAC-01 | VIEWER manage_users false | **PASS** | N/A |

**Contagem local:** 16 PASS / 0 FAIL / 0 BLOCKED

---

## 2. Guards estáticos

| ID | Cenário | Resultado |
|----|---------|-----------|
| G-01 | Todas as rotas `api/admin` + `workspaces` com guard | **PASS** (23) |
| G-02 | Sem `body.tenantId` não allowlisted em admin | **PASS** |

---

## 3. Mapeamento ao pedido §5 (cobertura)

| # | Requisito | Cobertura | Estado |
|---|-----------|-----------|--------|
| 1 | Não autenticado → rota protegida | Parcial (serviço; HTTP Admin **NOT RUN** Preview) | NOT RUN Preview |
| 2 | Sem role → op admin | ROLE-* + hasPermission | PASS local |
| 3 | Tenant A lê recurso B | CT-01, PL-01, MD-01 | PASS local |
| 4 | Tenant A update/delete B | CT-02/03, PL-02 | PASS local |
| 5 | Swap IDs cross-tenant | CT/PL/DV cases | PASS local |
| 6 | `tenant_id` pedido ≠ membership | bump/list com tenant errado | PASS local |
| 7 | Listagens sem leak | CT-01, PL-01 | PASS local |
| 8 | Media authz + tenant | MD-01 (DB); HTTP device-media **NOT RUN** Preview | PARCIAL |
| 9 | Admin rejeita tenant ausente/inválido | bump obrigatório | PASS local |
| 10 | bumpPlaylistVersion contrato | PL-03..05 | PASS local |
| 11 | Rotas públicas / OAuth | Inventário F-01 (sem middleware cego) | PASS guards |
| 12 | Regressão ops autorizadas | test:rbac + test:tenant + PL-05 | PASS local |

---

## 4. Preview isolado (Fase D) — 2026-10-17

| ID | Caso | Estado | Evidência |
|----|------|--------|-----------|
| P-01 | Deploy CLI worktree remediação | **BLOCKED** | `dpl_25Essba9…` / `vitrine360-6od8r6vhm-…`; `readyState=BLOCKED` (team collaboration) |
| P-02 | A-06 HTTP / mutações sintéticas no Preview | **NOT RUN** | Artefacto não READY — testes suspensos |
| P-03 | Device media 401 / `X-V360-Device-Auth` | **NOT RUN** | Idem |
| P-04 | Preview health ≠ Production | **PARCIAL** | Production alias `vitrine360-psi` health confirmado (`environmentHint=production`, bucket `vitrine360`). Preview RBAC URL ainda não serve `/api/health` JSON (página “building”/blocked) |
| P-05 | Aliases inalterados | **PASS** | Deploy `alias: []`; sem promote |

**Interrupção:** critério §6 — dúvida/ambiente não utilizável. Sem mutações cross-tenant no Preview.

### Pré-condições registadas

- Worktree `security/rbac-p0-p1` @ `9d4ee96`; WIP original 88.
- Locais reexecutados: guards PASS; A-06 16/16 PASS.
- Sem migrations novas.
- Env Preview tem chaves DB/R2/AUTH distintas de Production (valores não impressos).

### Desbloqueio necessário

Commit+push da branch **ou** aprovação do deployment CLI no dashboard Vercel.

---

## 5. Critério A-06 piloto

| Antes | Depois (local) | Preview |
|-------|----------------|---------|
| NOT TESTED | **16/16 PASS** | **NOT RUN** (deploy BLOCKED) |

**Não declarar A-06 fechado para lançamento** sem evidência Preview READY.
