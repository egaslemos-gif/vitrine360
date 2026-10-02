# PLAYER-PRO-02B — Regressão

| Verificação | Resultado |
|---|---|
| `npm test` (inclui RUNTIME-PLAYBACK-01..07 e 09 — comandos RP-07/09, RUNTIME-EXPERIENCE-09/10/11, CONTENT-TEMPLATES-01, PLAYER-RELIABILITY-01 14/14, PLAYER-PRO-02 15/15, PLAYER-PRO-02A 6/6, PLAYER-PRO-02B 18/18) | **exit 0** |
| `tsc --noEmit` | **exit 0** |
| `next build` | **exit 0** |
| `eslint .` | **116 (6 erros, 110 avisos) = baseline, 0 novos** |
| **STOP durante carregamento** (`live-player-pro-02a-validate`, Chrome real) | **13/13** |
| `live-player-pro-02-validate` real / `SIM_POLICY=1` / `=2` (eventos de gerações antigas, STOP/seek/mute, matriz) | **17/17** · **4/4** · **2/2** |
| `test:react-player-live` | **15/15** |
| `test:device-media-range-live` | **15/15** |
| `test:tv-video-live` (`tv.js` e proxy **não alterados** nesta fase) | 10/10 · 10/10 · **9/10** em três execuções seguidas — falha intermitente `TV-DURATION-01` (`lasted 5,7 s (media 5,1 s), loops=1`), ver nota |

**Nota sobre `TV-DURATION-01`:** o teste detecta "voltas" por amostragem a 500 ms (queda de `currentTime` > 1,0 s para < 0,6 s); um item natural de 5,1 s com 0,6 s de latência de amostragem pode ser contado como volta. Nenhum ficheiro envolvido (`public/tv.js`, rota de media, armazenamento) foi alterado na PRO-02, 02A ou 02B, e o mesmo teste deu 10/10 em todas as execuções anteriores desta sessão e em 2 de 3 nesta. Classificado como instabilidade de medição do teste, **não** como regressão; fica registado para acompanhamento, sem alteração.

Timestamps de documentos de evidência regenerados por `npm test` (18 ficheiros, 1 linha cada): repostos **um a um**, apenas esses, após confirmar que a única diferença era a linha de data.

Sem commit, push ou deploy; sem alterações em Production; sem validação física de Smart TV.
