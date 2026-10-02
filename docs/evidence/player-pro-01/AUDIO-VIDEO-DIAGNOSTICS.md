# PLAYER-PRO-01 — Diagnóstico de áudio e vídeo

## Instrumentação (temporária, externa, removível)
`docs/evidence/player-pro-01/instrument.js`, injectado com `page.addInitScript` pela sonda. **Não faz parte do bundle e não altera o código da aplicação.** Regista: evento (`loadstart, loadedmetadata, canplay, playing, pause, waiting, stalled, error, ended, volumechange, seeked`), tipo de elemento, `paused`, `muted`, `volume`, `currentTime`, `readyState`, `error.code`, final do `currentSrc` com `token=***`, e as rejeições de `play()` (`name`+mensagem). Nada de cookies, tokens ou URLs assinados completos. Saídas: `probe-events.json` (110 eventos, sem rejeições, sem erros de página) e `probe-sim-events.json`.

> Nota técnica: a primeira versão da instrumentação (função TypeScript) falhou silenciosamente com `__name is not defined` (esbuild `keepNames` dentro de `addInitScript`); foi corrigida passando JavaScript puro. Os resultados de controlos (C/D/E/G) usam `page.evaluate` e não foram afectados.

## Fluxo auditado
`Slide` (adaptador) cria `<video autoPlay playsInline muted={state.muted} preload="auto">` → `setMediaEl` (ref estável) chama `ensureMediaPlayback` se `status === PLAYING` → `onLoadedMetadata` emite `MEDIA_READY` e volta a chamar `ensureMediaPlayback` → `onLoadedData`/`onCanPlay` chamam-no outra vez → efeito `[status, volume, muted, generation]` chama-o se `el.paused`.

`ensureMediaPlayback`: (1) aplica volume/mute desejados e tenta `play()` com som; (2) se rejeitar → `startMuted()`; (3) após o play mudo bem sucedido, **tenta desmutar** (`applyDesiredAudio`) e, 250 ms depois, outra vez; (4) se ainda mudo regista um listener de `pointerdown/keydown` para desmutar; (5) rejeição do play mudo → `onUnrecoverable` → `MEDIA_PLAY_ERROR`.

## Resultados por requisito
| # | Requisito | Resultado | Evidência |
|---|---|---|---|
| 1 | Distinguir autoplay bloqueado de erro de descodificação | **Código distingue**: `play()` rejeitado → `MEDIA_PLAY_ERROR` (recuperável); `<video onError>` → `MEDIA_DECODE_ERROR`. **Mas** `onError` usa sempre `DECODE_ERROR`, mesmo para `MEDIA_ERR_SRC_NOT_SUPPORTED`/rede (`video.error.code` 4/2 não é lido) | `playback-renderer-adapter.tsx` `onError` |
| 2 | PLAYING lógico × reprodução observada | **Divergem** em dois casos reproduzidos: `STOPPED`/`PAUSED` com elemento a tocar (probe C2/C3, **CONFIRMED**) e `PLAYING` com elemento pausado (simulação S2, **mecanismo reproduzido**) | `PLAYER-CONTROL-MATRIX.md` |
| 3 | Vídeo renderizado × áudio audível | O estado não distingue. Nenhum campo indica "a reproduzir mudo por política". `state.muted` é intenção do utilizador; o fallback muda `el.muted` sem actualizar o estado | RC-04 |
| 4 | Quem silencia | Três fontes possíveis: aplicação (`SET_MUTED`), elemento (fallback `startMuted`) e política do browser. Só a primeira é visível na UI | RC-04 |
| 5 | Elemento real | `HTMLVideoElement` também para AUDIO (1×1 px, `opacity .01`). **Não existe `HTMLAudioElement`** | adaptador ~733 |
| 6 | `play()` rejeitado deixa estado recuperável? | **Não completamente.** Rejeição do play mudo → `PAUSED` sem mensagem e **sem recuperação automática** (`usePlaybackRecovery` só trata `ERROR` e `LOADING`). Recuperável apenas por acção manual | `onMediaError` (`MEDIA_PLAY_ERROR`) |
| 7 | Retry reutiliza o mesmo elemento | Sim para Play manual (efeito `[status]`) e `ensureMediaPlayback`. `NEXT`/`RESTART`/retry automático (`PLAY` a partir de `ERROR`) **criam nova geração → novo elemento** | `beginCurrentItem` |
| 8 | Libertação do elemento anterior | **OK.** `disposeMediaElement` (pause, remove `src`, `load()`) na troca de geração e no cleanup do `Slide`. Probe: nunca mais de um `<video>` activo. Observação: `mediaRef.current = null` é feito durante o render (origem dos 6 erros de lint pré-existentes) | adaptador 123-129 |
| 9 | Codec × ausência de suporte × autoplay | `canPlayType` é consultado **só em `development`** e apenas regista; `MEDIA_UNSUPPORTED` existe mas **nunca é emitido**. Em produção todo o erro de media é `MEDIA_DECODE_ERROR` | RC-09 |

## Autoplay: o que o Chrome automatizado mostra e o que não mostra
- Com `--autoplay-policy=document-user-activation-required` o vídeo arrancou **com som e sem gesto** (probe A0/A1: `muted=false, paused=false`, zero rejeições). O Chrome do Playwright/headed controlado por automação **não impõe a política real** (perfil novo sem MEI/engagement e sinalizador de automação). Portanto **o sintoma "sem áudio" não é reproduzível neste ambiente** e não deve ser classificado como confirmado.
- `SIM_POLICY=1` emula a política documentada do Chromium (play com som sem activação → `NotAllowedError`; `muted=false` sem activação num elemento já a tocar → pausa). Resultado **da simulação**:
  - arranque sem gesto: 4 rejeições `NotAllowedError`; evento `playing` mudo; a seguir `volumechange` (desmutar) → `pause`; estado final `PLAYING`, elemento `paused=true`, botão "Pause" visível (**S2 defeito**);
  - o primeiro gesto do utilizador **não** recupera (o listener `pointerdown/keydown` só é registado quando `el.muted && !el.paused`) (**S3 defeito**);
  - a única recuperação é "Pause" e "Play" (2 cliques) (**S4 OK**).
- Esta é a causa mais provável da combinação de sintomas "arranca sozinho mas às vezes sem áudio" + "controlos parecem não funcionar" + "playlist pára": **LIKELY** (mecanismo provado em simulação; falta confirmar em Chrome/SRAF real).

## Limitação de plataforma (documentada, não contornável)
Um browser pode recusar reprodução **com som** sem gesto do utilizador. Não se deve tentar contornar. O comportamento correcto é: arrancar mudo, **mostrar um estado explícito "som bloqueado — toque para activar"**, e activar som+reprodução no primeiro gesto. Em equipamentos controlados (quiosque próprio) existe a flag do browser `--autoplay-policy=no-user-gesture-required`, fora do âmbito da aplicação. **PLATFORM LIMITATION.**

## Sequência fim de item → início do seguinte
Probe G (75 s): VIDEO→IMAGE 0 ms de intervalo útil; IMAGE→AUDIO; AUDIO→VIDEO com um `LOADING` de ≈ 0,3 s (`0:video:LOADING` seguido de `PLAYING`). Sem saltos, sem itens a sobrepor-se.
