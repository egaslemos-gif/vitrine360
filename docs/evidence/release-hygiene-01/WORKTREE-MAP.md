# WORKTREE-MAP — RELEASE-HYGIENE-01

Estado: **nenhum commit, nenhum push, nenhuma alteração funcional.** Só foram criados ficheiros em `docs/evidence/release-hygiene-01/`.
Base: `main` @ `ea7ddc9`. 25 ficheiros rastreados modificados + 55 não rastreados (+10 screenshots).

Legenda: **A** AUTHZ-DEVICE-02 · **B** MEDIA-RUNTIME-01 · **C** PLAYBACK-LAB · **D** outra tarefa / resíduo · **E** documentação/evidência

## Classificação

| Ficheiro | Cat. | Commit |
|---|---|---|
| `src/lib/api.ts` | A | AUTHZ |
| `src/lib/api-error-mapping.ts` (novo) | A | AUTHZ |
| `src/lib/api-error-mapping.test.ts` (novo) | A | AUTHZ |
| `src/lib/api.test.ts` (novo) | A | AUTHZ |
| `src/features/devices/pair-device-form.tsx` | A | AUTHZ |
| `src/domain/device-authz.test.ts` (novo) | A | AUTHZ |
| `scripts/test-platform-identity-10g.ts`, `…-10j.ts` (1 linha cada: contrato `QUOTA_EXCEEDED`) | A | AUTHZ |
| `scripts/authz02-e2e-seed.ts`, `scripts/authz02-e2e-browser.ts` (novos) | A | AUTHZ |
| `docs/evidence/authz-device-02/*` (14 ficheiros + 10 screenshots) | A·E | AUTHZ |
| `docs/evidence/authz-device-01/*` (9 ficheiros, novos) | A·E | AUTHZ (ver decisão 2) |
| `src/lib/playback-lab-guard.ts` (novo) | C | MEDIA-LAB |
| `src/app/player/lab/layout.tsx` (novo) | C | MEDIA-LAB |
| `src/app/player/lab/page.tsx` (guard removido) | C | MEDIA-LAB |
| `scripts/test-playback-lab-guard.ts` (novo) | C | MEDIA-LAB |
| `.env.example` (+ `PLAYBACK_LAB_ENABLED` comentado) | C | MEDIA-LAB |
| `docs/evidence/media-runtime-01/BROWSER-LAB-ENABLEMENT.md` (novo) | B·E | MEDIA-LAB |
| **`package.json`** — **partilhado** | A + C | **dividido por patches** (ver abaixo) |
| 18× `docs/evidence/{platform-identity-10b/c/d/f/g/i/j,runtime-experience-01…10,runtime-playback-01}/*.md` | D | **não commitar**: só timestamps regenerados pelo `npm test` (+18/−18) |
| `build-current.txt`, `diff1-4.txt`, `git-diff-stat.txt`, `git-status.txt`, `lint-base.txt`, `lint-current.txt`, `test-results.txt`, `typecheck-current.txt` | D | **não commitar**: resíduos locais |

**Categoria B (código de MEDIA-RUNTIME-01):** não há código pendente. A implementação já está no `HEAD` (`5edc138`). De B só há a documentação do Lab.
Nenhum ficheiro do Playback Runtime/Renderer foi alterado.

## `package.json` partilhado
Tem 3 alterações: `test:authz-device-02` (A), `test:playback-lab-guard` (C) e uma cadeia `test` que termina em `… 10j && playback-lab-guard && authz-device-02`.
Em vez de `git add package.json`, foram gerados dois patches, **verificados** com `git apply --check --cached` num índice temporário (índice real intocado):
1. `package-json-AUTHZ.patch` — aplica-se ao `HEAD`.
2. `package-json-MEDIA-LAB.patch` — aplica-se **depois** do 1.º; o resultado final é idêntico à working tree actual.

Se a ordem for invertida, o patch 2 terá de ser regenerado.

## Riscos a ter em conta
1. **Atomicidade do Lab.** `page.tsx` já não bloqueia produção; o bloqueio vive em `layout.tsx` + `playback-lab-guard.ts`. Commitar `page.tsx` sem o layout **expõe o Lab em produção**. Os 3 ficheiros têm de ir no mesmo commit.
2. **Independência de A e C.** Nenhum ficheiro de A importa algo de C, nem o inverso. Podem ser commitados por qualquer ordem, tirando o `package.json`.
3. `scripts/authz02-e2e-seed.ts` tem uma password fixa **sintética** (`Authz02Pass!`). O script recusa correr fora de uma BD `file:…authz02…`. Não é uma credencial real. A BD e o JSON de seed ficam em `data/`, que está no `.gitignore`.
4. `docs/evidence/authz-device-02/e2e-results.json` contém apenas emails sintéticos `@authz02-*.test`.

## Decisões pendentes (suas)
1. Apagar ou `.gitignore` os 11 resíduos `*.txt` da raiz?
2. `docs/evidence/authz-device-01/*` (docs da fase 01, nunca commitados): incluir no commit AUTHZ ou num commit à parte?
3. Descartar (`git checkout --`) as 18 alterações de timestamps em docs antigos?

## Validação do estado
| Item | Estado | Nota |
|---|---|---|
| AUTHZ-DEVICE-02 | **VALIDATED**, com uma ressalva | Todos os critérios da checklist 02B cumpridos excepto `npm run lint` (6 erros **pré-existentes**, fora do âmbito, 0 em ficheiros A). Ao confirmar "validado", assumo que aceita o critério como "sem novos erros de lint". A checklist estrita ainda diria PENDING |
| MEDIA-RUNTIME-01 | **TECHNICALLY READY FOR BROWSER E2E** | Código no `HEAD`; `npm test` exit 0, typecheck e build PASS. Falta apenas o ambiente (Lab acessível), ver abaixo |
| Playback Lab | **READY FOR PREVIEW DEPLOYMENT** (código) | Bloqueado em produção sem flag e disponível com `PLAYBACK_LAB_ENABLED=true`, verificado em build/`next start` reais. **Ainda não está deployed**: precisa de commit/push do conjunto MEDIA-LAB e de `PLAYBACK_LAB_ENABLED=true` só no ambiente Preview, definido antes do build, porque `/player/lab` é estático |

Nenhuma verificação foi repetida nesta fase. O código não mudou desde a última execução completa (`npm test` exit 0, typecheck PASS, build PASS, E2E 71/71).

## Ordem de commit sugerida (NÃO executada)
```
# 1) AUTHZ
git apply --cached docs/evidence/release-hygiene-01/package-json-AUTHZ.patch
git add $(grep -v '^#' docs/evidence/release-hygiene-01/AUTHZ-FILES.txt)
git commit -m "fix(devices): structured API errors and Pair Device UX (AUTHZ-DEVICE-02)"

# 2) MEDIA-LAB
git apply --cached docs/evidence/release-hygiene-01/package-json-MEDIA-LAB.patch
git add $(grep -v '^#' docs/evidence/release-hygiene-01/MEDIA-LAB-FILES.txt)
git commit -m "feat(player): env-gated Playback Lab for Preview E2E (PLAYBACK_LAB_ENABLED)"
```
O `$(…)` com caminhos sem espaços funciona porque nenhum caminho da lista tem espaços.
