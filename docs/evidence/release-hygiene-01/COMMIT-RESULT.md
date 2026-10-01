# COMMIT-RESULT — RELEASE-HYGIENE-02

Branch `main`, 2 commits à frente de `origin/main`. **Sem push. Sem deploy. Variáveis Vercel e Production não tocadas.**

| Trabalho | Hash | Mensagem | Ficheiros |
|---|---|---|---|
| AUTHZ-DEVICE-02 | `76a1d5a` | `fix(authz): harden device authorization and error UX` | 45 (+2792 / −42) |
| MEDIA-LAB | `faa4e6c` | `chore(player): enable playback lab for preview environments` | 7 (+134 / −9) |

## Commit `76a1d5a` — AUTHZ
- Código: `src/lib/api.ts`, `src/lib/api-error-mapping.ts`, `src/features/devices/pair-device-form.tsx`.
- Testes: `src/lib/api.test.ts`, `src/lib/api-error-mapping.test.ts`, `src/domain/device-authz.test.ts`.
- Scripts: `scripts/authz02-e2e-seed.ts`, `scripts/authz02-e2e-browser.ts`.
- Contratos: `scripts/test-platform-identity-10g.ts`, `…-10j.ts`.
- `package.json`: **só** o patch AUTHZ (script `test:authz-device-02` e o fim da cadeia `test`).
- Docs: `docs/evidence/authz-device-01/` (9) e `docs/evidence/authz-device-02/` (14 + 10 screenshots).
- Antes do commit: `git diff --cached --check` limpo, depois de remover espaços no fim de 3 linhas em 2 docs do `authz-device-01` (só docs).

## Commit `faa4e6c` — MEDIA-LAB
`src/lib/playback-lab-guard.ts`, `src/app/player/lab/layout.tsx`, `src/app/player/lab/page.tsx`, `scripts/test-playback-lab-guard.ts`, `.env.example`, `docs/evidence/media-runtime-01/BROWSER-LAB-ENABLEMENT.md` e **só** o patch MEDIA-LAB do `package.json` (script `test:playback-lab-guard` e a sua entrada na cadeia).
`git diff --cached --check` limpo.

## Excluídos dos dois commits
- 11 resíduos `.txt`: **apagados** (ver `POST-CLEANUP.md`).
- 18 docs de evidência com alterações só de timestamp: **restaurados** ao `HEAD` (e restaurados de novo depois do `npm test` da validação).
- `docs/evidence/release-hygiene-01/` (este directório): **por commitar**, não pertence a nenhum dos dois conjuntos.
- Nenhum ficheiro de Playback Runtime/Renderer, nem código funcional fora das listas.

## Resultados dos testes
**AUTHZ isolado** (Lab guardado em stash por pathspec, árvore = `HEAD` do AUTHZ):

| Verificação | Resultado |
|---|---|
| `npm test` | exit 0 (93 testes em `test:authz-device-02`, 0 falhas) |
| `npm run build` | exit 0 |
| `npm run typecheck` | exit 0 na repetição. A 1.ª execução falhou por um tipo obsoleto em `.next/types/validator.ts` (referia `lab/layout.tsx`, removido pelo stash temporário). A build seguinte regenerou-o. Artefacto da validação, não do commit |
| Browser E2E 71/71 | não repetido, conforme pedido (sem alteração funcional desde a validação) |

**Lab** (builds reais; a variável é lida em build time):

| `PLAYBACK_LAB_ENABLED` | `/player/lab` | `/player` |
|---|---|---|
| não definida | BLOQUEADO | 200 |
| `false` | BLOQUEADO | 200 |
| `true` | ACTIVO | 200 |

`npm run test:playback-lab-guard`: PASS.
Nota: à data deste documento não tinha sido repetido o `npm test` completo com os dois commits juntos. Foi repetido na revalidação final, ver `FINAL-STATUS.md`.

## Detalhes factuais (resumo; detalhe em `POST-CLEANUP.md`)
- **`diff1.txt`…`diff4.txt`:** estavam em UTF-16 (redirecção PowerShell), por isso o `git apply` não os lia. Convertidos para UTF-8: `diff1-3` revertem limpo sobre o `HEAD` (já em `5edc138`); em `diff4`, 40/40 linhas adicionadas estão no `HEAD` e 0/24 removidas ainda lá estão. Nada ficou por commitar. Foram apagados.
- **Baseline de lint** (preservada no `POST-CLEANUP.md` antes de apagar `lint-base.txt`/`lint-current.txt`): 116 problemas, 6 erros, 110 warnings. Erros: `scripts/dump.ts:29` (`no-require-imports`, rastreado desde `5edc138`) e `src/player/playback/playback-renderer-adapter.tsx:123-127` (5× `react-hooks/refs`). O mais antigo `lint-base.txt` tinha 115/5, só com os 5 do adapter.
- **`package.json`:** dois patches (`package-json-AUTHZ.patch`, `package-json-MEDIA-LAB.patch`) aplicados com `git apply --cached`, o 2.º por cima do 1.º. Cada commit contém só a sua linha de script; a linha `test` aparece nos dois porque é uma única linha a que cada trabalho acrescentou um comando.

## Estado final
- Working tree: só `docs/evidence/release-hygiene-01/` por rastrear. Sem stashes.
- Lint: continua com os 6 erros pré-existentes, não corrigidos (0 novos).
- **AUTHZ-DEVICE-02 → VALIDATED** (critério de lint = "sem novos erros", conforme decidido).
- **MEDIA-LAB → READY FOR PREVIEW DEPLOYMENT**.
- **Production → INALTERADA.**
- **Deployment → NÃO EXECUTADO.**
