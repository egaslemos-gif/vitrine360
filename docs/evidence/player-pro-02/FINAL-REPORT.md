> **ATUALIZAÇÃO PLAYER-PRO-02B — desvio remoto RESOLVIDO.** Comandos remotos PAUSE/STOP numa EXPERIENCE são agora respondidos `REJECTED` / `NOT_SUPPORTED` sem tocar no controlador (estado, geração e `updatedAt` idênticos; sem notificações); MEDIA inalterado. 18/18 testes (`test:player-pro-02b`) com dispatcher, controlador e poller reais; `PRO02A-006` substitui o antigo `KNOWN-GAP`. Detalhe: `docs/evidence/player-pro-02b/`. A verificação 2 da 02A passa a **APROVADA** na totalidade; a PRO-02 está **pronta para revisão final pré-commit**. A secção "Desvio encontrado" e a "Decisão pedida" abaixo ficam como registo histórico.

# PLAYER-PRO-02A — Verificação final pré-commit (resultado)

**Veredicto da 02A (histórico): verificação 1 APROVADA · verificação 2 PARCIAL (desvio remoto) — o desvio foi resolvido na PLAYER-PRO-02B, ver acima.**

## 1. STOP durante carregamento — APROVADA
Script: `scripts/live-player-pro-02a-validate.ts` (`npm run test:player-pro-02a-live`), Chrome real. O pedido de media é retido pelo teste (Playwright `route`), o `<video>` fica em `LOADING` (`readyState=0`), prime-se **Stop antes de `loadedmetadata`/`loadeddata`/`canplay`**, e só depois se liberta a resposta (eventos nativos reais e tardios).

| Verificação | Código PRO-02 | Mesmo teste contra o código original |
|---|---|---|
| A-00/01 vídeo em LOADING com pedido retido; Stop → `STOPPED` | PASS | PASS |
| A-02 eventos tardios chegaram mesmo (`loadedmetadata` após Stop) | PASS (0 → 1) | PASS |
| **A-03 sem reprodução espontânea: `STOPPED`, `paused:true`, tempo 0** | **PASS** | **FAIL** (`STOPPED` com `paused:false`, `cur=2,69`) |
| A-04 geração inalterada (nada re-armou o item) | PASS | PASS |
| A-05 Play depois arranca normalmente | PASS | PASS |
| B-02 Stop → Next muda de geração (2 → 3) e passa ao item de imagem | PASS | PASS |
| B-03 eventos tardios do elemento antigo não afectam o novo item | PASS | PASS |
| B-04 a playlist volta ao vídeo e toca normalmente | PASS | PASS |
| **Total** | **13/13** | **12/13** (A-03) |

Causa no código original: com o `<video>` ainda sem metadados, `el.paused` já é `true`, por isso o `pause()` condicional do efeito (`if (!el.paused)`) não corria e o atributo `autoplay`/`ensureMediaPlayback` arrancavam o vídeo no `loadedmetadata`. Corrigido na PRO-02 (pausa incondicional + guarda por estado/geração); este teste é o seu teste de regressão. A comparação "antes" foi feita fazendo `git stash` de `src/` + `package.json`, rebuild e correndo o mesmo script (`stop-loading-before-fix.txt`); o working tree foi restaurado (`git stash pop`) e reconstruído.

## 2. Controlos EXPERIENCE — APROVADA (após PRO-02B; era PARCIAL)
Script: `scripts/test-player-pro-02a.ts` (`npm run test:player-pro-02a`, na cadeia de `npm test`).

| Verificação | Resultado |
|---|---|
| Play/Pause e Stop desactivados em todos os estados (LOADING, PLAYING, PAUSED, STOPPED, ENDED, ERROR) | **PASS** (`PRO02A-001`) |
| Nenhum outro controlo simula pausa: SEEK/VOLUME/MUTE ocultos; só ficam Anterior, Seguinte, Reiniciar, Repetição, Ecrã inteiro | **PASS** (`PRO02A-002`) |
| HTML renderizado (`react-dom/server`): botões Pause e Stop com `disabled`, sem slider, sem volume, sem mute; VIDEO mantém Pause activo (grupo de controlo) | **PASS** (`PRO02A-003`) |
| Nenhum caminho da UI local despacha PAUSE/STOP para EXPERIENCE (teclado com guarda antes de todos os despachos; só controlos/teclado despacham PAUSE/STOP no `src/player/playback`) | **PASS** (`PRO02A-004`) |
| Admissão, sandbox, bridge, runtime EXPERIENCE, `tv.js` e `command-*` **não alterados** (`git status` + EX-09/10/11 verdes; `experience-slide.tsx` sem conceito de estado/pausa) | **PASS** (`PRO02A-005`) |
| **Caminho remoto (comandos de dispositivo)** | era KNOWN-GAP → **PASS após PRO-02B** (`PRO02A-006`) |

### Desvio encontrado (fora do âmbito, não corrigido)
`command-dispatcher` → `mapCommandToPlaybackAction` → `PlaybackController` não filtra por tipo de conteúdo. Um comando remoto `PAUSE` ou `STOP` numa EXPERIENCE em reprodução é aplicado: o estado passa a `PAUSED`/`STOPPED` (teste: `PLAYING → PAUSED → … → STOPPED`) enquanto o conteúdo sandboxed continua visível e a correr; com `PAUSED` o temporizador do item pára e a experiência fica no ecrã indefinidamente. Isto contraria "a interface não declara PAUSED enquanto a experiência continua activa" **neste caminho**. É anterior à PRO-02 (o controlador e o dispatcher não foram alterados) e a interface local não o consegue provocar.
Opções para decisão (nenhuma implementada): (a) rejeitar PAUSE/STOP para EXPERIENCE no dispatcher com um código de rejeição de comando (altera contrato RUNTIME-PLAYBACK-07/PLAYBACK-CONTRACT — requer actualizar testes); (b) aceitar o comando mas tratá-lo como no-op controlado/`NOT_SUPPORTED` na ACK; (c) manter e documentar.

## Decisão pedida
O commit da PRO-02 **não depende** do desvio remoto (a interface local está correcta e a verificação 1 passou), mas como a verificação 2 não ficou totalmente limpa, **aguardo instrução**: autorizar o commit tal como está documentando o desvio, ou autorizar primeiro a correcção (a) ou (b) numa fase própria.

---

# PLAYER-PRO-02 — Relatório final

## Veredicto: **VALIDATED (browser automatizado) — validação física pendente**
Cumpre todos os critérios de fecho aplicáveis em ambiente automatizado: as três reproduções originais deixaram de ocorrer, regressão verde, `tsc` e `build` verdes, lint sem novos erros, estado do controlador e elemento coerentes nos cenários testados, repetição correcta, EXPERIENCE sem alterações de segurança, limitações de autoplay e Smart TV documentadas. **Não** declara paridade com a Hisense SRAF.

## As três reproduções originais (Chrome real)
| # | Reprodução | Antes | Depois |
|---|---|---|---|
| 1 | Stop seguido de `canplay`/`loadeddata`/`loadedmetadata` | vídeo volta a tocar com UI `STOPPED` | **parado** (`STOP-01`) |
| 2 | Seek durante pausa | vídeo retoma com UI `PAUSED` | **em pausa, sem avanço** (`SEEK-01/01b`) |
| 3 | 2.º seek para a mesma posição | ignorado | **aplicado** (`SEEK-02`) |

## Objectivos 1–8
1–3 acima · 4 `MEDIA_PLAY_ERROR` mantém `PAUSED`, sem avanço nem reconstrução, retry no mesmo elemento (`SIM2`) · 5 EXPERIENCE sem pausa fictícia · 6 mute/volume reflectem o estado efectivo, volume 0 ≠ mudo, desmutar restaura o nível e não reconstrói (`MUTE-01..04`, `SIM1`) · 7 buffering só quando observável + classificação de erros · 8 repetição em PT, `aria-pressed`, acessível <768 px (`REP-01..03`).

## Testes
`npm test` exit 0 (RP-01..07, EX-09/10/11, Content Templates, RELIABILITY-01 14/14, **PRO-02 15/15**) · `tsc` 0 · `build` 0 · lint 116 = baseline · live: real **17/17**, SIM1 **4/4**, SIM2 **2/2**, sonda PRO-01 **14/14**, range 15/15, tv 10/10, react-player 15/15. Detalhe em `REGRESSION.md`.

## Limitações e o que permanece por confirmar
1. **Smart TV / Hisense SRAF: não validado** (`PHYSICAL-TV-CHECKLIST.md`). O sintoma "sem áudio" continua **LIKELY/PLATFORM LIMITATION**: o Chrome automatizado não impõe a política de autoplay; os cenários de política são um **modelo** (`SIM_POLICY`).
2. **Ecrã sem supervisão e `MEDIA_PLAY_ERROR`:** por contrato (e por pedido expresso de não avançar em rejeições recuperáveis) fica em `PAUSED` até haver interacção. Uma política limitada de recuperação (retry mudo temporizado, escalada para erro) continua proposta, **não implementada**.
3. Elemento `muted=false` não prova som audível (volume do sistema/saída).
4. Buffering validado com eventos sintéticos; sem throttling real de rede.
5. EXPERIENCE: coberto por unitário/estrutura; sem teste de browser com pacote real nesta fase.
6. Lacunas de matriz: GIF→VIDEO, IMAGE→VIDEO, AUDIO→AUDIO, VIDEO→AUDIO directos; `STOP` durante `LOADING`; soak de horas.
7. Rótulos Play/Pause/Stop/Retry continuam em inglês (compatibilidade com testes); `logVideoDiag` agora só em dev.
8. Pendências antigas inalteradas: 6 erros de lint pré-existentes, pré-carga do item seguinte, persistência de volume, aviso de hidratação do editor de playlists.

## Ficheiros
Código: `playback-renderer-adapter.tsx`, `ensure-media-playback.ts`, `media-signal.tsx` (novo), `playback-controls.tsx`, `playback-chrome.tsx`, `control-availability.ts`, `use-playback-keyboard.ts`, `media-types.ts`, `package.json`. Testes: `scripts/test-player-pro-02.ts`, `scripts/live-player-pro-02-validate.ts`, `scripts/player-pro-01-probe.ts` (ajustes). Evidência: `docs/evidence/player-pro-02/` (+ `live-results-*.json`, `before-fix-live-results.txt`, `probe-*.json`, capturas).

## Reproduzir
```
DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
BASE_URL=http://localhost:3150 npm run test:player-pro-02-live
SIM_POLICY=1 BASE_URL=http://localhost:3150 npm run test:player-pro-02-live
SIM_POLICY=2 BASE_URL=http://localhost:3150 npm run test:player-pro-02-live
```
**Sem commit, push ou deploy.** À espera de revisão.
