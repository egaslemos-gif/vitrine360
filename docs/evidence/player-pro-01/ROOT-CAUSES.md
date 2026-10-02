# PLAYER-PRO-01 — Causas raiz

Classificação: **CONFIRMED** (reproduzido e demonstrado) · **LIKELY** (evidência forte, falta reprodução conclusiva) · **UNCONFIRMED** (hipótese) · **PLATFORM LIMITATION**.
Reprodução = `scripts/player-pro-01-probe.ts` (`SIM_POLICY=1` para a simulação de política de autoplay). Resultados em `probe-results.json`, `probe-sim-results.json`, `probe-events.json`, `probe-sim-events.json`.

---
## RC-01 — `ensureMediaPlayback` é chamado sem olhar para o estado lógico  · **CONFIRMED**
- **Sintoma:** depois de Parar, ou de procurar (seek) com o vídeo em pausa, o vídeo volta a tocar sozinho; a UI continua a mostrar `STOPPED`/`PAUSED` ("os controlos não funcionam / mentem").
- **Evidência:** probe **C2** (seek ← → em `PAUSED`: `status=PAUSED`, `paused=false`) e **C3** (Stop: 1,8 s depois `status=STOPPED`, `paused=false`, `cur=1.75`). Repetível em 2/2 execuções.
- **Onde:** `playback-renderer-adapter.tsx` `Slide` → `onLoadedMetadata`/`onLoadedData`/`onCanPlay` (vídeo ~654-679, áudio ~760-779) chamam `ensureMediaPlayback` incondicionalmente. O efeito `[status]` faz `el.currentTime = 0` em `STOPPED` e o seek do efeito `[positionMs]` altera `currentTime` em `PAUSED`; ambos disparam `canplay`/`seeked` → `play()`.
- **Causa confirmada:** os handlers de media não consultam o estado actual do controlador.
- **Impacto:** alto (Stop/Pause/seek enganadores; áudio a tocar com UI parada).
- **Correcção mínima:** os handlers só chamam `ensureMediaPlayback` quando o estado mais recente (`latestPlayback.current.status`, já existente) for `LOADING` ou `PLAYING` (não `PAUSED/STOPPED/ENDED/ERROR/IDLE`). Atenção: no arranque o estado ainda é `LOADING` quando chega `loadedmetadata`, por isso `LOADING` tem de continuar elegível.
- **Testes:** probe C2/C3 passam a verde; teste de unidade do adaptador com elemento falso (canplay em `STOPPED` ⇒ sem `play()`); regressão: arranque, NEXT, retry após erro.
- **Risco de regressão:** médio-baixo (caminho de arranque; mitigado pela probe e `test:react-player-live`).

## RC-02 — `seekAppliedRef` nunca é reposto  · **CONFIRMED**
- **Sintoma:** o 2.º seek para a mesma posição (p. ex. Home duas vezes, ou clicar na mesma marca) não faz nada.
- **Evidência:** probe **E1**: Home → 3,3 s de reprodução → Home: posição 4,26 s (devia ser ≈ 0).
- **Onde:** `playback-renderer-adapter.tsx` efeito `[positionMs, status, generation, item]` — `if (seekAppliedRef.current !== null && |seekAppliedRef - target| < 50) return;`; o ref persiste entre itens e nunca volta a `null`.
- **Causa confirmada:** guarda anti-repetição sem condição de reinício.
- **Impacto:** médio (seek/Home/R não fiáveis; "controlos inconsistentes").
- **Correcção mínima:** repor `seekAppliedRef.current = null` no evento `seeked`, na mudança de geração e quando o elemento volta a avançar.
- **Testes:** probe E1; unitário (duas ordens de seek idênticas). **Risco:** baixo.

## RC-03 — Arranque mudo → "desmutar" sem gesto pausa o elemento; estado fica `PLAYING`  · **LIKELY**
- **Sintoma:** "os vídeos iniciam automaticamente, mas por vezes sem áudio"; vídeo parado com botão "Pause" visível; playlist "pára" na fronteira de vídeo; primeiro clique não resolve.
- **Evidência (simulação de política):** S2 e S3 — 4× `NotAllowedError`; `playing` mudo → `volumechange` (desmutar) → `pause`; final `PLAYING` + `paused=true`; clique no ecrã não recupera; só Pause→Play recupera (S4). O Chrome automatizado **não** aplica a política (A1 arranca com som), logo não há reprodução em ambiente real. Os comentários do próprio código ("CRITICAL… leaves the element paused", "audio stays paused forever after browser reload") descrevem o mesmo mecanismo.
- **Onde:** `ensure-media-playback.ts` `startMuted()` → `applyDesiredAudio()` (desmuta imediatamente) e `recoverIfPausedAfterUnmute()` (verifica `el.paused` **de forma síncrona**, antes de a pausa assíncrona do browser); o temporizador de 250 ms só actua se `!el.paused`; o listener de gesto só é registado se `el.muted && !el.paused`.
- **Causa:** hipótese forte, não confirmada em hardware.
- **Impacto:** alto em quiosques/TVs sem gesto inicial.
- **Correcção mínima:** (a) nunca desmutar por código sem activação — manter mudo e expor "som bloqueado"; (b) registar o listener de gesto sempre que `muted` foi forçado pela aplicação (independente de `paused`), e nesse gesto: `muted=false` + `play()`; (c) reconciliar `pause`/`playing` (ver RC-14).
- **Testes:** `SIM_POLICY` S1–S4 transformados em asserts; Chrome real e SRAF físico (checklist no plano).
- **Risco:** médio (toca no caminho de autoplay; requer teste em equipamento).

## RC-04 — O estado lógico `muted` não reflecte o estado efectivo  · **CONFIRMED (código) / impacto LIKELY**
- **Sintoma:** botão "Mute" 🔊 com o vídeo silencioso (mudo por fallback ou política).
- **Onde:** `ensureMediaPlayback` altera `el.muted` sem despachar `SET_MUTED`; `PlaybackControls` usa só `state.muted`.
- **Impacto:** médio (UI indica sucesso que não existe). **Correcção mínima:** estado local do adaptador "áudio bloqueado" (via evento `volumechange` + política), exposto à chrome por contexto/prop, **sem** segunda fonte de verdade para índice/estado de reprodução. **Testes:** SIM S1. **Risco:** baixo-médio.

## RC-05 — `MEDIA_PLAY_ERROR` → `PAUSED` silencioso e sem recuperação  · **CONFIRMED (código)**
- **Sintoma:** ecrã sem supervisão parado em `PAUSED`; sem mensagem.
- **Onde:** `PlaybackController.onMediaError` (`code === "MEDIA_PLAY_ERROR"` → `commit({status:"PAUSED", error:null})`); `usePlaybackRecovery` só trata `ERROR` e `LOADING`.
- **Impacto:** alto em signage (parado indefinidamente). **Frequência real:** UNCONFIRMED (o play mudo raramente é recusado).
- **Correcção mínima:** na `usePlaybackRecovery`, um watchdog de `PAUSED` causado por play-error (distinguir por `error`/marcador no adaptador sem alterar o contrato do controlador) → 1 retry mudo → `NEXT`. **Testes:** unitário do hook. **Risco:** médio (não confundir com Pause do utilizador).

## RC-06 — EXPERIENCE ignora PAUSE/STOP mas o botão está activo  · **CONFIRMED (código)**
- **Onde:** `experience-slide.tsx` não recebe `status`; `resolveControlAvailability` activa `PLAY_PAUSE`/`STOP` para EXPERIENCE. O temporizador pára, o iframe continua.
- **Impacto:** baixo-médio. **Correcção mínima:** desactivar/ocultar Play/Pause e Stop para EXPERIENCE em `control-availability.ts` (puro, sem tocar no runtime EXPERIENCE nem no seu isolamento). **Testes:** RP-04 (disponibilidade). **Risco:** baixo.

## RC-07 — Repetição pouco legível; some em ecrãs pequenos  · **CONFIRMED (código)**
- **Onde:** `playback-controls.tsx` (~487-505, `compact` esconde Stop/Restart/Volume/Repeat); rótulo "Repeat PLAYLIST", ícones ambíguos, sem `aria-pressed`. Um clique no padrão → `ITEM`.
- **Impacto:** médio (modo errado sem o utilizador saber; pode causar "pára no último vídeo" com `NONE`). **Correcção mínima:** rótulos PT, texto curto do modo, `aria-pressed`, manter o botão em `compact`. **Risco:** baixo.

## RC-08 — Classificação de erros de media grosseira; `MEDIA_UNSUPPORTED` nunca emitido  · **CONFIRMED (código)**
- **Onde:** adaptador `<video onError>` → sempre `MEDIA_DECODE_ERROR`; não lê `el.error.code`; `canPlayType` só em `development`.
- **Impacto:** baixo (diagnóstico). **Correcção mínima:** mapear `MediaError.code` (1 aborted, 2 network, 3 decode, 4 src not supported) e `canPlayType` para os códigos já existentes. **Risco:** baixo.

## RC-09 — Sem indicador de buffering (`waiting`/`stalled` ignorados)  · **CONFIRMED (código)**
- **Impacto:** médio-baixo (a UI diz `PLAYING` durante stalls; o watchdog só actua em `LOADING`). **Correcção mínima:** estado local "buffering" por eventos `waiting`/`playing`. **Risco:** baixo.

## RC-10 — Troca de item/RESTART/1 item recarrega o ficheiro  · **CONFIRMED (código), LOW**
- `applyItemAt` incrementa `generation` → `key` do `<video>` muda → remonta. Playlist de 1 item recarrega o vídeo a cada volta (sem pré-carga do seguinte). Funcionalmente correcto; custo de rede/flicker. **Fora do âmbito imediato.**

## RC-11 — Autoplay com som bloqueado sem gesto  · **PLATFORM LIMITATION**
Política do Chrome/Chromium (e, por extensão, SRAF/Vidaa). Não contornar. Mitigação: arrancar mudo, estado explícito, activar no 1.º gesto; equipamento controlado pode usar a flag do browser (fora da aplicação).

## RC-12 — "A playlist pára no último vídeo"  · **UNCONFIRMED (causa); contrato CONFIRMED conforme**
Não reproduzido (≥ 4 ciclos no React; `tv.js` 10/10). Causas plausíveis: RC-03 (próximo vídeo arranca pausado), RC-07 (modo `ITEM`/`NONE` sem querer), RC-05. Ver `REPEAT-MODE-AUDIT.md`.

## RC-13 — Diferença de comportamento computador × SRAF Hisense  · **UNCONFIRMED (sem hardware)**
Nenhum teste Chromium é validação de Smart TV. O runtime legacy `tv.js` não foi alterado nem testado em hardware nesta fase. A paridade só pode ser concluída com a checklist física do plano.

## RC-14 — Não há reconciliação físico → lógico (causa estrutural de RC-01/03/04/09)  · **CONFIRMED (código)**
O adaptador só escuta `loadedmetadata/loadeddata/canplay/timeupdate/ended/error`; `pause`, `playing`, `waiting`, `stalled`, `volumechange` e `seeked` não chegam ao controlador nem à UI. Correcção: um único ponto de reconciliação **no adaptador** (não um segundo controlador), emitindo apenas as acções já existentes e estado de apresentação local. **Risco:** médio; requer RC-01 primeiro.

## Descartadas / sem defeito
- Padrão de repetição, volta ao 1.º item, eventos tardios de geração, libertação do elemento, fixed-window vs natural, seek/mute/volume/pausa — conformes (probe e testes).
- `tickImageElapsed` e `onMediaEnded`: fim emitido uma só vez por geração.
