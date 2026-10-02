# PLAYER-PRO-01 — Auditoria do contrato de repetição

## Contrato pretendido × implementação
| Requisito | Implementação (ficheiro:função) | Evidência | Resultado |
|---|---|---|---|
| Padrão `PLAYLIST` | `createInitialPlaybackState` → `repeatMode: "PLAYLIST"` (`playback-state.ts`) | `REL-010`; probe F1 lê "Repeat PLAYLIST" no arranque | **CONFIRMED conforme** |
| Último → primeiro (vários itens) | `PlaybackController.next()` (`atLast` + `PLAYLIST` → `selectIndex(0)`) e `onMediaEnded` → `next()` | RP-01/02/03; probe G2: índices `0,1,2,0,1,2,0,1,2,…` (≥ 4 ciclos) | **CONFIRMED conforme** |
| `ITEM` repete só o actual | `onMediaEnded` → `beginCurrentItem` (nova geração) | RP-02 (linhas ~326) | Conforme |
| `NONE` termina no último | `next()`/`onMediaEnded` → `ENDED` | RP-01 (~148/200) | Conforme |
| Playlist vazia → `IDLE` | `loadPlaylist`/`syncPlaylist` | RP-01/02 | Conforme |
| Estado de repetição inequívoco na UI | `playback-controls.tsx` ~487-505 | Rótulo **inglês** "Repeat PLAYLIST"; ícones `↻`/`¹`/`↷` ambíguos; sem `aria-pressed`; **botão oculto em ecrãs ≤768 px** | **Falha parcial (RC-07)** |
| Repetição sem temporizadores externos | só o controlador decide; o `PresentationTimer` só emite elapsed | `REL-012` | Conforme |
| Manifesto não reinicia a playlist nem perde o modo | `syncPlaylist` não toca em `repeatMode`; remapeia por `playlistItemId` → `contentId` → índice | RP-02/03 (`RP02-031`, SYNC_PLAYLIST) | Conforme |
| Mudança de modo com testes próprios | `SET_REPEAT_MODE` coberto indirectamente em RP-01/02/03; o ciclo `nextRepeatMode` está testado (RP-04); **não há teste que fixe a persistência de `repeatMode` através de `SYNC_PLAYLIST`** | — | **Lacuna de teste** |

## Fim natural: exactamente um evento de conclusão?
| Caso | Origem do fim | Garantia de evento único |
|---|---|---|
| VIDEO/AUDIO natural | `onEnded` nativo → `MEDIA_ENDED(generation)` | `onMediaEnded` só avança se `status === PLAYING` e `generation` coincide; o elemento é descartado na troca de geração → eventos tardios são rejeitados. Probe: sem saltos duplos (índices sequenciais) |
| VIDEO/AUDIO janela fixa | `PresentationTimer` → `tickImageElapsed` → `onMediaEnded` | `loop` activo ⇒ `ended` nativo nunca dispara; o `position >= duration` chama `onMediaEnded` **uma vez** (a geração muda logo a seguir) |
| IMAGE / TEXT / CLOCK / EXPERIENCE | `PresentationTimer` | idem |
| Áudio | igual a vídeo (elemento `<video>`) | idem; probe: AUDIO→VIDEO e AUDIO→IMAGE ok |

Não foi encontrado defeito na semântica de `generation`/`MEDIA_ENDED`; **não se propõe alterá-la**.

## "A playlist pára no final do último vídeo" — não reproduzido; causas plausíveis
O sintoma **não foi reproduzido** no player React (probe G2, > 4 ciclos) nem no `tv.js` (`test:tv-video-live` 10/10). Hipóteses, por ordem de probabilidade:

1. **LIKELY — o item seguinte arranca sem som e fica parado.** Na transição último→primeiro cria-se um `<video>` novo. Sem activação do utilizador (típico em TV/quiosque) o `play()` com som é rejeitado; o fallback muda para mudo e depois tenta desmutar, o que (em Chrome/Chromium) **pausa o elemento**. O estado lógico fica `PLAYING` (ver RC-03), a playlist "pára" exactamente numa fronteira de vídeo. Reproduzido em simulação de política.
2. **LIKELY — modo alterado sem querer.** O botão cicla `PLAYLIST → ITEM → NONE`: **um clique** no estado padrão deixa o modo `ITEM` (repete só o item), dois deixam `NONE` (pára no fim). O rótulo é inglês e o botão some em ecrãs ≤768 px.
3. **CONFIRMED (código) — `MEDIA_PLAY_ERROR` → `PAUSED` silencioso** (`onMediaError`), sem recuperação para `PAUSED` (a recuperação só trata `ERROR` e `LOADING`). Um ecrã sem supervisão fica parado até alguém carregar em Play.
4. UNCONFIRMED — runtime legacy SRAF: `tv.js` implementa `% length` (REL-005); não foi testado em hardware.

## Sem alteração funcional nesta fase
Proposta (fase seguinte): manter o padrão e a semântica; tornar o modo visível (rótulo PT + texto/ícone distinto + `aria-pressed`, também em ecrãs pequenos) e acrescentar testes: `SYNC_PLAYLIST` preserva `repeatMode`, `ITEM`+erro, `NONE` fim → `ENDED` e `PLAY` recomeça.
