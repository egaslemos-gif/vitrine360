# FINAL-STATUS — RELEASE-HYGIENE-02

## A. Git baseline (antes do commit documental)
| Item | Valor |
|---|---|
| Branch | `main` |
| HEAD | `faa4e6c05ec5e983a442fa98530c9ba9c969950a` |
| `origin/main` | `ea7ddc9186ef10b09ac212aba9c991178d74f2d3` (= `HEAD~2`) |
| Ahead / behind | 2 / 0 |
| Alterações em ficheiros rastreados | 0 (staged 0) |
| Stashes | 0 |
| Não rastreado | só `docs/evidence/release-hygiene-01/` |

## B. Commits funcionais
| Hash | Mensagem | Ficheiros | Conteúdo |
|---|---|---|---|
| `76a1d5a` | `fix(authz): harden device authorization and error UX` | 45 | AUTHZ-DEVICE-02: `api.ts`, `api-error-mapping.ts`, `pair-device-form.tsx`, testes, scripts seed/E2E, contratos PI10G/PI10J, docs `authz-device-01/02`, parte AUTHZ do `package.json` |
| `faa4e6c` | `chore(player): enable playback lab for preview environments` | 7 | MEDIA-LAB: `playback-lab-guard.ts`, `lab/layout.tsx`, `lab/page.tsx`, teste do guard, `.env.example`, `BROWSER-LAB-ENABLEMENT.md`, parte Lab do `package.json` |

Isolamento verificado: nenhum ficheiro Lab no commit AUTHZ e nenhum ficheiro AUTHZ no commit Lab. O único ficheiro comum é `package.json`, com linhas de script distintas (cada commit acrescentou a sua; a linha `test` é única e foi estendida por ambos).
`git diff origin/main..HEAD` = 51 ficheiros (44 adicionados, 7 modificados), 2925 inserções / 50 remoções. **Todos** pertencem a um dos dois commits (45 + 7 − 1 partilhado). Nenhum ficheiro inesperado.

## C. Commit documental
Terceiro commit, `docs(release): record commit isolation and hygiene validation`, contendo exclusivamente `docs/evidence/release-hygiene-01/`. Este ficheiro não pode conter o seu próprio hash; consultar `git log -1` (o hash foi comunicado no relatório da fase).

## D. Testes (main como está, antes do commit documental)
| Comando | Resultado |
|---|---|
| `npm test` | exit 0; `test:authz-device-02`: 93 testes, 0 falhas; nenhuma linha `FAIL` |
| `npm run test:playback-lab-guard` | PASS |

Browser E2E 71/71: não repetido (sem alteração funcional desde a validação).

## E. Typecheck
`npm run typecheck`: exit 0 na 1.ª execução (sem `.next/types` obsoleto) e exit 0 outra vez depois do build.

## F. Build
`npm run build`: exit 0. `/player` e `/player/lab` estáticos (`○`).
Valores do Lab por configuração (builds reais, fase anterior): variável ausente → bloqueado; `false` → bloqueado; `true` → activo; `/player` 200 em todas.

## G. Lint e baseline
116 problemas, **6 erros**, 110 warnings: idêntico à baseline documentada (`POST-CLEANUP.md`).
Erros: `scripts/dump.ts:29` e `src/player/playback/playback-renderer-adapter.tsx:123-127`. Problemas nos ficheiros dos dois commits: **0**. Nenhum erro novo. Nada foi corrigido.

## H. Working tree
Depois dos testes, o `npm test` voltou a reescrever timestamps (`Generated:`/`**Date:**`) em 18 docs de evidência. Foi verificado que eram as mesmas 18 e que não havia outra linha alterada (0), e foram restaurados ficheiro a ficheiro com `git checkout -- <ficheiro>` (sem `checkout -- .`).
Estado antes do commit documental: 0 alterações rastreadas, 0 stashes, só `docs/evidence/release-hygiene-01/` por rastrear.

## I. Push
**NÃO EXECUTADO.** `main` fica 3 commits à frente de `origin/main`.

## J. Deploy
**NÃO EXECUTADO.** Nenhum `vercel deploy`/`npm run deploy`.

## K. Production
**INALTERADA.** Nenhuma variável Vercel alterada; `PLAYBACK_LAB_ENABLED` não foi definida em Production.

## L. Próximo passo autorizado
Aguardar autorização explícita para:
1. `git push` dos 3 commits (ou só dos 2 funcionais).
2. Definir `PLAYBACK_LAB_ENABLED=true` **apenas** no ambiente Preview da Vercel, **antes** do build do Preview (`/player/lab` é estático e lê a variável em build time).
3. Deploy Preview e execução do Browser E2E do MEDIA-RUNTIME-01 nesse URL.

## Conclusão
**RELEASE-HYGIENE-02 — VALIDATED**
- AUTHZ-DEVICE-02 = VALIDATED (lint = sem novos erros)
- MEDIA-LAB = READY FOR PREVIEW
- RELEASE DOCUMENTATION = COMMITTED (3.º commit)
- PRODUCTION = UNCHANGED
- PUSH = NOT PERFORMED
- DEPLOY = NOT PERFORMED
