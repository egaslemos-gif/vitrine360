# PLAYER-PRO-02 — Implementação

Restrições respeitadas: `PlaybackController`, `playback-state.ts`, `playback-timing.ts`, manifesto, BD, runtime EXPERIENCE, `tv.js` e Production **não foram alterados**; nenhum controlador/índice/temporizador novo; sem deploy/commit/push.

## Ficheiros alterados (8) e novos
| Ficheiro | Alteração |
|---|---|
| `src/player/playback/playback-renderer-adapter.tsx` | `startIfWanted` (guarda: geração actual **e** estado `LOADING/PLAYING`) em todos os handlers `loadedmetadata/loadeddata/canplay` (vídeo+áudio); `pause()` incondicional em `PAUSED/STOPPED`; elemento montado em `PAUSED/STOPPED` não arranca (`autoplay=false`+`pause()`); `seekAppliedRef` → `seekInFlightRef` (só enquanto o seek está em curso; limpo em `seeked` e na mudança de geração); sinais observáveis do elemento (`volumechange/pause/playing/waiting/stalled/canplay/seeked/timeupdate`) e *handler* de gesto; classificação de erros (`emitNativeError`); não força `muted=false` sem activação do utilizador; `logVideoDiag` só em dev |
| `src/player/playback/ensure-media-playback.ts` | Já **não desmuta por código** quando o browser diz que não houve activação (`navigator.userActivation.hasBeenActive === false`); se a API não existir (TVs antigas) tenta uma vez e **verifica de forma assíncrona** (300 ms) — se o browser pausou, volta a mudo no mesmo elemento; no 1.º gesto (`pointerdown/keydown/touchend`, uma vez) restaura o som pretendido e o `play()` no mesmo elemento; novo `enableSoundOnElement`, `readUserActivation`, `onAudioBlocked`, `hasUserActivation` (injectável para testes) |
| `src/player/playback/media-signal.tsx` (novo) | Store **só de apresentação** (áudio bloqueado, mudo efectivo, buffering, reprodução bloqueada, tipo de erro) + canal para o gesto do utilizador. Não contém estado de reprodução, índice nem temporizadores |
| `src/player/playback/playback-chrome.tsx` | cria o store e envolve controlos+media num `MediaSignalProvider` |
| `src/player/playback/playback-controls.tsx` | estado efectivo: "Ativar som" quando o som está bloqueado, ícone/`aria-pressed` coerentes, volume 0 ≠ mudo, desmutar restaura o volume anterior; nota `role=status` ("A carregar…", "Som bloqueado…", "O navegador bloqueou a reprodução…", falha de rede/descodificação/formato); Play age no mesmo elemento quando a reprodução está bloqueada; repetição em português (`Repetição: repetir lista/repetir item/sem repetição`), `aria-pressed`, visível também em ecrãs <768 px |
| `src/player/playback/control-availability.ts` | EXPERIENCE: Play/Pause e Stop desactivados (sem suspensão real) |
| `src/player/playback/use-playback-keyboard.ts` | EXPERIENCE ignora Espaço/Play/Pause/Stop (sem pausa fictícia) |
| `src/player/playback/media-types.ts` | `classifyMediaError({errorCode, online})` → `MEDIA_LOAD_ERROR` (rede/aborto), `MEDIA_DECODE_ERROR`, `MEDIA_UNSUPPORTED`, `MEDIA_ERROR`; nunca devolve URLs nem mensagens do browser |
| `package.json` | `test:player-pro-02` (na cadeia de `npm test`) e `test:player-pro-02-live` |
| `scripts/test-player-pro-02.ts` (novo) | 15 guardas estáticas/unitárias |
| `scripts/live-player-pro-02-validate.ts` (novo) | 17 verificações em Chrome real + modos `SIM_POLICY=1|2` |
| `scripts/player-pro-01-probe.ts` | `PROBE_OUT`, selector de repetição e seek em pausa por `Home` |
| `docs/evidence/player-pro-02/*` | evidência; `instrument.js` (instrumentação externa, só nos testes) |

## Decisões
1. **Guarda por estado no adaptador, não no controlador.** O controlador já rejeitava eventos tardios por geração; o defeito estava no adaptador, que reagia a eventos nativos sem consultar o estado.
2. `LOADING` continua elegível para arranque: `loadedmetadata` chega antes de o estado passar a `PLAYING`.
3. **`MEDIA_PLAY_ERROR → PAUSED` mantido** (contrato RP-05/PLAYBACK-CONTRACT-01). Não há avanço automático nem reconstrução do elemento: o utilizador volta a carregar em Play (mesmo elemento, dentro do gesto). Documentado como limitação para ecrãs sem supervisão.
4. **Nunca presumir áudio audível:** o estado apresentado deriva do elemento (`el.muted`) e da intenção (`state.muted`); não existe "afirmação de som" só pelo estado lógico. Ainda assim `muted=false` num elemento a tocar **não prova** som audível (volume do sistema, saída de áudio) — fora do que o browser expõe.
5. **Pausa de EXPERIENCE:** o runtime/bridge não tem API de suspensão; desactivar é mais honesto que parar só o temporizador. A navegação (Anterior/Seguinte) e repetição continuam disponíveis.
6. **Repetição:** a lógica não foi tocada (testes confirmam `PLAYLIST` padrão, último→primeiro, `ITEM`, `NONE`); só interface.
7. Não foi criada a política de avanço por "PLAYING sem avanço" (item 7 do plano PRO-01): contraria "não avançar em rejeição recuperável" e fica para fase própria.
