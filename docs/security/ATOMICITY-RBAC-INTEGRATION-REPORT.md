# ATOMICITY + RBAC — relatório de integração local

**Data:** 2026-10-19
**Branch de integração:** `security/rbac-p0-p1-atomicity`
**Worktree:** `E:/PROJECTOS IA/UNILICUNGO/PROJECTOS FCT2026/Vitrine360-atomicity-on-security`
**Pai do commit de fecho:** `809a950ea3668126b04b0a5d4e857339896dad66`
**Mensagem:** `fix(playlists): preserve tenant RBAC in atomic item additions`
**Método:** edição manual, sem cherry-pick. Sem push, deployment ou migração remota.

## Hashes registados no início e no fim

| Ref | SHA | Mudou? |
|---|---|---|
| `main` | `e338f842f4fad53d425bae87b9dd9dad35d858cf` | não |
| `origin/main` | `6a9efb03f1e79165d1c30811b375456fec689a22` | não |
| `security/rbac-p0-p1` | `809a950ea3668126b04b0a5d4e857339896dad66` | não |
| `origin/security/rbac-p0-p1` | `809a950ea3668126b04b0a5d4e857339896dad66` | não |
| commit integrado à mão | `e338f842f4fad53d425bae87b9dd9dad35d858cf` | aplicado como diff editado, não como cherry-pick |
| este worktree antes do commit | `809a950` | alterações só neste working tree |

Os worktrees de `main` e de `security/rbac-p0-p1` não foram editados.

## O que entrou

| Ficheiro | Origem |
|---|---|
| `src/services/playlists.ts` | resolução manual: atomicidade de `e338f84` + contrato F-03 de `809a950` |
| `src/services/activity-log.ts` | parâmetro `tx?` do commit, compatível com todos os chamadores actuais |
| `scripts/test-playlist-atomicity.ts` | teste do commit, mais T8a/T8b para o contrato RBAC. O comentário de schema foi ajustado: aplica os `.sql` deste ramo, não a migração `0012` |
| `src/domain/device-command.ts` | `FORCE_SYNC` aceite com payload vazio |
| `src/domain/command-mapping.ts` | `FORCE_SYNC` não é acção de playback (`FORCE_SYNC_NOT_PLAYBACK`) |

Não foi copiado `docs/diagnostics/PLAYLIST-ATOMICITY-IMPLEMENTATION-REPORT.md`. Esse texto descreve `tenantId` opcional e `WHERE` só por id. No ramo de segurança isso contradiz o F-03.

`node_modules` deste worktree é uma junction para o `node_modules` de `main`. Não é alteração de código.

## Contrato que ficou

`bumpPlaylistVersion(playlistId, tenantId, tx?)`:

- `tenantId` continua obrigatório. Vazio ou só espaços lança `tenantId is required to bump playlist version`.
- Playlist, devices ligados e cada device são filtrados por `scopedTenantId`.
- Com `tx`, todas essas queries usam o handle. Sem `tx`, usam `db`.
- `addPlaylistItem` corre dentro de `db.transaction` (`BEGIN IMMEDIATE`), com o mutex por playlist: validação de tenant, `max(position)`, inserção, bump e `playlist.item_added` no mesmo `tx`.
- Hints `FORCE_SYNC` são calculados dentro da transacção e só são enfileirados depois do `await db.transaction`. Não são acção de playback: `mapCommandToPlaybackAction` lança `FORCE_SYNC_NOT_PLAYBACK`. O player deste ramo não tem referências a `FORCE_SYNC`; o comando fica na inbox. Isto não é sincronização funcional completa.
- Se o enqueue ou o import do serviço falhar, o `catch` absorve o erro e `addPlaylistItem` devolve o id. A inserção já commitada não é revertida nem escondida.
- Sem `tx` (reorder, remove, update, update de detalhes), o enqueue é imediato e best-effort, depois das escritas. Isto é novo face a `809a950`, que não enfileirava comandos.

Chamadores revistos:

| Chamada | Argumentos |
|---|---|
| `addPlaylistItem` | `tenantId` + `tx` |
| `updatePlaylistDetails`, `reorderPlaylistItems`, `removePlaylistItem`, `updatePlaylistItem` | `tenantId`, sem `tx` |
| `scripts/acceptance-mvp.ts` | `tenantId`, sem alteração |
| `scripts/test-rbac-cross-tenant-a06.ts` | sem alteração; continua a exigir tenant e a tratar o tenant errado como no-op |

## Diff (working tree, sem commit)

```
 src/domain/command-mapping.ts  |   2 +
 src/domain/device-command.ts   |   5 +-
 src/services/activity-log.ts   |  29 +++--
 src/services/playlists.ts      | 199 +++++++++++++++++++++---------
 scripts/test-playlist-atomicity.ts  (não rastreado)
```

`git diff --stat` dos quatro ficheiros rastreados: 4 files, 167 insertions, 68 deletions, mais o teste novo.

## Testes observados neste fecho

Reexecutados nesta sessão, com bases `file:` novas em `%TEMP%` (`rbac-a06-close.db`, `v360-rbac-close.db`, `v360-tenant-close.db`, mais a base própria da suite de atomicidade). Os 10 `.sql` de `drizzle/` deste ramo foram aplicados antes de A-06, `test:rbac` e `test:tenant`, e a coluna `effective_playback_key` foi acrescentada nessas três bases porque este ramo não tem a migração `0012`. O dotenv injectou 0 variáveis. Nenhuma base remota foi usada. Estes resultados são os desta execução, não os da sessão anterior.

| Suite | Resultado |
|---|---|
| `scripts/test-playlist-atomicity.ts` | **24/24 PASS** — sucesso, rollback do bump, rollback da inserção, 5 adições paralelas, isolamento de tenant na adição, auditoria atómica, regressão das operações existentes, `tenantId` vazio rejeitado, bump do outro tenant é no-op |
| `npm run test:rbac-a06` | **16 PASS, 0 FAIL**, incluindo `A06-PL-03`, `A06-PL-04`, `A06-PL-05`, `A06-PL-06`, `A06-DV-02` |
| `npm run test:rbac` | `workspace rbac phase 2 tests passed` |
| `npm run test:tenant` | `tenant isolation tests passed` |
| `npx tsc --noEmit` | **0 erros** neste worktree |

A primeira tentativa de A-06, `test:rbac` e `test:tenant` correu contra ficheiros SQLite vazios. `ensureSchema()` não cria `playlist_items` / `tenants`. As suites foram repetidas depois de aplicar localmente os 10 `.sql` de `drizzle/` deste ramo. `test:tenant` precisou ainda da coluna `effective_playback_key`, que neste ramo só nasce em `ensureSchema()` (não há migração `0012`). A-06 chama `ensureSchema()` e por isso não esbarrou nisso. Não é uma falha da transacção: o `SELECT` de devices já pedia a coluna no schema de `809a950`.

A suite A-06 reescreveu o timestamp de `docs/security/RBAC-A06-LOCAL-RESULTS.json`. Esse ficheiro foi reposto ao conteúdo de `809a950` para não misturar o artefacto com a integração. O resultado 16/0 está na saída da suite.

## Limitações

1. O player deste ramo não consome `FORCE_SYNC`. Não há sincronização funcional completa: o hint é só uma linha na inbox.
2. `FORCE_SYNC` não estava em `e338f84` nem em `809a950`. O tipo foi acrescentado aqui para o enqueue não falhar com `INVALID_COMMAND`.
3. Bumps sem transacção podem escrever na inbox para devices `ACTIVE`. A-06 desta sessão continuou verde.
4. A migração `0012` não entrou. Sem `ensureSchema()`, a coluna `effective_playback_key` continua ausente.
5. O relatório original da Etapa 2 não foi copiado, porque descreve um bump sem filtro de tenant.
6. O hash deste commit não cabe dentro do próprio objecto Git. Identifica-se por ser o primeiro commit desta branch acima de `809a950`, com a mensagem indicada no cabeçalho.

## Fecho

Commit local único. Sem push e sem deployment. `main` permanece em `e338f84`. `security/rbac-p0-p1` e `origin/security/rbac-p0-p1` permanecem em `809a950`.
