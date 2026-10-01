# POST-CLEANUP — RELEASE-HYGIENE-02

## 1. Resíduos removidos (11 `.txt` na raiz, todos não rastreados)

| Ficheiro | Natureza | Verificação antes de remover |
|---|---|---|
| `build-current.txt`, `typecheck-current.txt`, `test-results.txt` | saída de `npm run build/typecheck/test` (UTF-16, redirecção PowerShell) | reproduzível; nenhum doc depende do conteúdo |
| `git-status.txt`, `git-diff-stat.txt` | saída de `git status`/`git diff --stat` de uma sessão anterior | instantâneo obsoleto |
| `diff1.txt` … `diff4.txt` | `git diff` de `playback-renderer-adapter.tsx`, `playback-state.ts`, `manifest.ts`, `playlist-builder.tsx` | convertidos de UTF-16: diff1-3 revertem limpo sobre o `HEAD` (já commitados em `5edc138`); diff4: 40/40 linhas adicionadas presentes no `HEAD` e 0/24 removidas ainda presentes. Nada por commitar |
| `lint-base.txt`, `lint-current.txt` | saída de `npm run lint` | citados como baseline em 2 docs; conteúdo preservado abaixo e referências actualizadas |

Não foram adicionados ao `.gitignore`. `dump.txt` e `dump_turso.txt` (rastreados) não foram tocados.

### Baseline de lint preservada (era o único conteúdo com valor de evidência)
| Ficheiro | Resultado | Erros |
|---|---|---|
| `lint-base.txt` (mais antigo) | 115 problemas, 5 erros | `src/player/playback/playback-renderer-adapter.tsx` 123, 124, 125, 126, 127 — `react-hooks/refs` |
| `lint-current.txt` (antes das tarefas AUTHZ/LAB) | 116 problemas, 6 erros | os 5 acima **+** `scripts/dump.ts:29` — `no-require-imports` |

`scripts/dump.ts` está rastreado desde `5edc138` (`HEAD`), logo o 6.º erro é do `HEAD` e não de AUTHZ/LAB. Última execução com a working tree das duas tarefas: 116 problemas / 6 erros, ou seja, **0 novos**.

## 2. 18 documentos restaurados (`git checkout -- <ficheiro>`, um a um)
`platform-identity-{10b,10c,10d,10f,10i,10j}/TEST-RESULTS.md`, `platform-identity-10g/REGRESSION-RESULTS.md`, `runtime-experience-{01…10}/*-CHECKLIST.md` (10 ficheiros), `runtime-playback-01/TEST-REPORT.md`.
Antes de restaurar: as 18 alterações eram exclusivamente as linhas `Generated:`/`**Date:**` (0 outras linhas).
Não foi usado `git checkout -- .`.

## 3. Estado da working tree depois da limpeza
Modificados (7): `.env.example`, `package.json`, `scripts/test-platform-identity-10g.ts`, `scripts/test-platform-identity-10j.ts`, `src/app/player/lab/page.tsx`, `src/features/devices/pair-device-form.tsx`, `src/lib/api.ts`.
Novos: ver `AUTHZ-FILES.txt` e `MEDIA-LAB-FILES.txt`, mais `docs/evidence/release-hygiene-01/` (não pertence a nenhum dos dois commits).
Nenhum ficheiro fora dos dois conjuntos.
