# PLAYER-PRO-01 — Matriz de controlos

Fonte: código (`playback-controls.tsx`, `use-playback-keyboard.ts`, `control-availability.ts`, adaptador) + sonda de browser (Chrome real). "Probe" = reproduzido em `scripts/player-pro-01-probe.ts`.

| Controlo | Evento UI | PlaybackAction | Efeito no media element | Estado esperado | Resultado observado | Estado |
|---|---|---|---|---|---|---|
| Play | `onClick` (rótulo "Play"); Espaço; `MediaPlayPause`; keyCode 415 | `PLAY` | A partir de `PAUSED` → efeito `[status]` chama `ensureMediaPlayback` se `el.paused`. De `STOPPED/ENDED/ERROR` → `beginCurrentItem` (nova geração → novo `<video>`) | `PLAYING` | Probe C4: Play após Stop reinicia (OK). **Se o estado já é `PLAYING` mas o elemento está pausado, `PLAY` é no-op no controlador** (`play()` ignora `PLAYING`) | OK / ver RC-03, RC-14 |
| Pause | `onClick` ("Pause"); Espaço; keyCode 19 | `PAUSE` | efeito `[status]` → `el.pause()` | `PAUSED` | Probe C1 OK | OK |
| Stop | `onClick` ("Stop", oculto em ecrãs ≤768 px); `MediaStop`; keyCode 413 | `STOP` | `el.pause()` + `currentTime = 0` | `STOPPED`, elemento parado | **Probe C3: elemento volta a reproduzir sozinho** (1,8 s depois: `paused=false`, estado `STOPPED`). Causa: `currentTime=0` dispara `canplay` → `ensureMediaPlayback` incondicional | **DEFEITO CONFIRMED (RC-01)** |
| Anterior | `onClick`; PageUp; `P`; `MediaTrackPrevious`; keyCode 412; Shift+← | `PREVIOUS` | nova geração → `<video>`/slide novo; >3 s → reinicia o item | item anterior / reinício | Coberto por RP-01/02 (controlador). Sem defeito observado | OK |
| Seguinte | `onClick`; PageDown; `N`; `MediaTrackNext`; keyCode 417; Shift+→ | `NEXT` | nova geração; último item + `PLAYLIST` → índice 0 | item seguinte / volta ao 1.º | Probe G2: 3+ ciclos completos | OK |
| Reiniciar | `onClick` ("Restart", oculto ≤768 px); `R` | `RESTART` | `beginCurrentItem` → **remonta** o elemento (recarrega o ficheiro) | posição 0 | OK funcionalmente; custo: recarrega o vídeo (não faz `currentTime=0`) | OK / LOW (RC-10) |
| Seek | pointer no slider; ←/→ ±5 s (só AV com duração conhecida); Home/End | `SEEK` | efeito `[positionMs]`: `el.currentTime = …` se deriva >400 ms | posição pretendida | **Probe E1: um 2.º seek para a mesma posição (Home→Home) é ignorado** (`seekAppliedRef` nunca é reposto): antes 3,35 s → depois 4,26 s. **Probe C2: seek com o vídeo pausado faz o vídeo retomar** (estado `PAUSED`, `paused=false`) | **DEFEITOS CONFIRMED (RC-02, RC-01)** |
| Volume | `input[type=range]` (oculto ≤768 px); ↑/↓ ±5 % | `SET_VOLUME` | efeito `[volume]` → `el.volume` | volume aplicado | Probe D3: 0,30 aplicado | OK |
| Mute | `onClick` ("Mute"/"Unmute"); `M`; ↑ desmuta | `SET_MUTED` | efeito `[muted]` → `el.muted` | silenciado / não | Probe D1/D2 OK (com activação). **O botão reflecte o estado lógico, não o efectivo** (RC-04) | OK / RC-04 |
| Repetição | `onClick` (rótulo inglês "Repeat PLAYLIST/ITEM/NONE"; oculto ≤768 px) | `SET_REPEAT_MODE` | n/a | modo activo | Probe F1: padrão `PLAYLIST`, ciclo `PLAYLIST→ITEM→NONE→PLAYLIST`. **Um único clique a partir do padrão passa a `ITEM`** | OK / RC-07 |
| Ecrã inteiro | `onClick`; `F`; 1.º gesto (automático) | política de fullscreen (`FullscreenController`) | Fullscreen API | estado observado | Validado em `test:react-player-live`. Botão sem `aria-pressed` | OK / LOW |

## Disponibilidade por tipo (`resolveControlAvailability`)
| Tipo | Seek | Volume/Mute | Play/Pause | Observação |
|---|---|---|---|---|
| VIDEO / AUDIO natural | sim (duração conhecida) | sim | sim | |
| VIDEO / AUDIO janela fixa | sim, mas a linha do tempo é a da janela e o vídeo faz `loop` | sim | sim | posição mapeada `% natural` |
| IMAGE (GIF = IMAGE com mime `image/gif`) | não (barra só de apresentação) | oculto | sim (pausa o temporizador) | correcto |
| TEXT / NOTICE / EVENT / NEWS / QR_CODE / CLOCK | não | oculto | sim (pausa o temporizador) | correcto |
| EXPERIENCE | não | oculto | **sim — mas o iframe/runtime não recebe PAUSE/STOP** | botão aparentemente activo que não pára o conteúdo (RC-06) |

`GIF` **não é um `ContentType`** (`src/domain/types.ts`): um GIF é `IMAGE` com `image/gif`. O ramo `type === "GIF"` em `isStillMedia`/`isGifMedia` é código morto defensivo; a sonda confirmou que o upload com `type=GIF` devolve 400.

## Divergência estado lógico × comportamento físico (resumo)
1. `STOPPED`/`PAUSED` com elemento a reproduzir (RC-01) — **confirmado**.
2. `PLAYING` com elemento pausado e sem recuperação (RC-03) — **mecanismo reproduzido em simulação**.
3. `muted=false` lógico com elemento efectivamente silencioso (RC-04).
4. Posição lógica ≠ posição física após seek repetido (RC-02) — **confirmado**.
5. O adaptador só escuta `loadedmetadata/loadeddata/canplay/timeupdate/ended/error`; **não escuta `pause`, `playing`, `waiting`, `stalled`, `volumechange`** — não há reconciliação físico→lógico (RC-14).
