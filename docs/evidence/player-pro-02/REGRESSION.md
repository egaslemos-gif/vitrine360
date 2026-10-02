# PLAYER-PRO-02 — Regressão

| Verificação | Antes | Depois |
|---|---|---|
| `npm test` (inclui RUNTIME-PLAYBACK-01..07, 09; RUNTIME-EXPERIENCE-09/10/11; CONTENT-TEMPLATES-01; PLAYER-RELIABILITY-01 14/14; **PLAYER-PRO-02 15/15**) | exit 0 | **exit 0** |
| `tsc --noEmit` | exit 0 | **exit 0** |
| `eslint .` | 116 (6 erros, 110 avisos) | **116 (6 erros, 110 avisos)** — 0 novos. Durante a fase surgiram 2 erros `react-hooks/refs` (ref no render em `media-signal.tsx` e reposição no bloco de render do adaptador); foram corrigidos em vez de aceites |
| `next build` | exit 0 | **exit 0** |
| `test:device-media-range-live` | 15/15 | **15/15** |
| `test:tv-video-live` (`tv.js`, não alterado) | 10/10 | **10/10** |
| `test:react-player-live` | 15/15 | **15/15** |
| `live-player-pro-02-validate` real | 5 FAIL / aborto | **17/17** (executado 4×; 1 falha inicial era do próprio teste — amostra transitória `LOADING` contada como item repetido — e foi corrigida no teste, não no produto) |
| `SIM_POLICY=1` / `=2` | S2/S3 defeito | **4/4** / **2/2** |
| Sonda PRO-01 | 11/14 | **14/14** |

## Matriz de transições (browser real)
Playlist `VIDEO → IMAGE(png) → IMAGE(gif) → AUDIO(wav)`; GIF = `IMAGE` com `image/gif` (não existe tipo `GIF`; o upload com `type=GIF` devolve 400).
- Sequência observada em 32 s: `1:still > 2:still > 3:audio > 0:video > 1:still > 2:still > 3:audio > 0:video > 1:still` — IMAGE→GIF, GIF→AUDIO, AUDIO→VIDEO, VIDEO→IMAGE e último→primeiro, em ordem (`MATRIX-01`).
- **Durante carregamento:** 3× `NEXT` consecutivas (120 ms) → 2,5 s depois estado `PLAYING` e elemento a tocar (`MATRIX-02`).
- Já cobertos por LIVE anteriores: VIDEO natural vs janela fixa, item avariado (retry + salto).
- **Lacunas que permanecem:** GIF→VIDEO e IMAGE→VIDEO directos, AUDIO→AUDIO, VIDEO→AUDIO directo; `STOP` durante `LOADING` (só coberto por estrutura: guarda por estado); ciclos de horas (soak); rede degradada real.

## Estado do working tree
8 ficheiros de `src/` + `package.json` modificados; novos: `media-signal.tsx`, 2 scripts de teste, evidência PRO-01/PRO-02. Os 18 documentos com carimbos de data foram repostos ficheiro a ficheiro. **Sem commit, push ou deploy.**

---
# PLAYER-PRO-02A — regressão directamente relacionada (após as verificações)

| Verificação | Resultado |
|---|---|
| `live-player-pro-02a-validate` (STOP durante carregamento) | **13/13**; contra o código original: 12/13 (A-03 falha) |
| `test-player-pro-02a` (EXPERIENCE) | **5 PASS** + 1 `KNOWN-GAP` (remoto, ver FINAL-REPORT) |
| `live-player-pro-02-validate` real / SIM1 / SIM2 | **17/17** · **4/4** · **2/2** |
| `test:react-player-live` / `test:tv-video-live` / `test:device-media-range-live` | **15/15** · **10/10** · **15/15** |
| `npm test` (RP-01..07, EX-09/10/11, Content Templates, RELIABILITY-01 14/14, PRO-02 15/15, PRO-02A) | **exit 0** |
| `tsc --noEmit` | **exit 0** |
| `next build` | **exit 0** |
| `eslint .` | **116 (6 erros, 110 avisos) = baseline, 0 novos** |
| Timestamps de 18 docs regenerados por `npm test` | repostos ficheiro a ficheiro |

Ficheiros adicionados nesta verificação: `scripts/live-player-pro-02a-validate.ts`, `scripts/test-player-pro-02a.ts`, 2 scripts em `package.json` (`test:player-pro-02a` na cadeia de `npm test`, `test:player-pro-02a-live`), evidência `stop-loading-*.{json,png,txt}`. Nenhum ficheiro de `src/` foi alterado nesta verificação. Sem commit, push ou deploy; sem validação física de Smart TV.

---
# Atualização PLAYER-PRO-02B
`test-player-pro-02a`: **6 PASS** (o `KNOWN-GAP` remoto passou a `PRO02A-006`). `test-player-pro-02b`: **18 PASS**. `npm test` exit 0, tsc 0, build 0, lint 116 = baseline; STOP durante carregamento 13/13; live PRO-02 17/17 · 4/4 · 2/2. Ver `docs/evidence/player-pro-02b/REGRESSION.md` (inclui nota sobre falha intermitente de medição em `test:tv-video-live`, ficheiros não alterados).
