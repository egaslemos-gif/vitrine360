# PLAYER-PRO-02 — Falha de play() e áudio (P1-A, P1-C)

> **Honestidade sobre o ambiente:** o Chrome automatizado **não aplica** a política de autoplay (o vídeo arranca com som sem gesto). Os cenários de política usam o modelo `instrument.js` (`SIM_POLICY`): modo 1 = play com som recusado sem gesto e "desmutar" sem gesto pausa o elemento; modo 2 = qualquer `play()` recusado sem gesto. São **simulações** do comportamento documentado do Chromium, não a política real nem uma TV.

## Classificação do contrato (sem alterações ao controlador)
| Situação | Estado | Comportamento |
|---|---|---|
| Autoplay com som recusado, mudo permitido | `PLAYING`, elemento a tocar **mudo** | UI: botão "Ativar som" + nota "Som bloqueado pelo navegador — toque para ativar"; 1.º gesto restaura o som no **mesmo** elemento |
| Autoplay recusado mesmo mudo (`MEDIA_PLAY_ERROR`) | `PAUSED` (contrato RP-05) | **Sem avanço automático**, sem reconstruir o elemento; Play repete no mesmo elemento |
| Elemento pausado pelo browser com estado `PLAYING` | `PLAYING` + sinal `playBlocked` | UI deixa de mostrar "Pause": nota "O navegador bloqueou a reprodução — toque para reproduzir"; Play/gesto repõe no mesmo elemento |
| Erro de carregamento/descodificação | `ERROR` | recuperação existente (1 retry + `NEXT`), agora com classificação |

## Resultados (modelo de política)
| Teste | Antes (PRO-01) | Depois |
|---|---|---|
| SIM1-01 play com som recusado → continua a tocar (mudo), não congela | S2 **defeito** (`PLAYING` + `paused:true`) | **PASS** (`PLAYING`, `paused:false`, `muted:true`) |
| SIM1-02 UI honesta (`Ativar som`, nota `sound-blocked`) | não existia | **PASS** |
| SIM1-03 1.º gesto restaura o som, no elemento que já tocava | S3 **defeito** | **PASS** (`muted:false`, `paused:false`) |
| SIM1-04 política realmente exercida | — | **PASS** (4 rejeições `NotAllowedError`) |
| SIM2-01 recusa total → `PAUSED`, `idx` inalterado ao fim de 6 s | — | **PASS** |
| SIM2-02 Play repete no **mesmo elemento** e toca | S4 (2 cliques) | **PASS** (`same:true`) |

Unitário com elemento falso (`PRO02-007b`, `PRO02-008`): sem activação → nunca `muted=false` por código; `onAudioBlocked(true)`; 1 listener de gesto, uma só vez; gesto restaura volume/mute pretendidos; play mudo recusado → `onUnrecoverable("muted_autoplay_denied")` uma única vez.

## Mute e volume (P1-C) — Chrome real
- MUTE-01 Mute → `muted:true`, rótulo "Unmute" · MUTE-02 Unmute → `muted:false`, a tocar, **mesmo elemento** (marcador JS persiste) · MUTE-03 volume 0 **não** é mudo (rótulo continua "Mute", `volume:0`) · MUTE-04 desmutar a partir de volume 0 restaura o nível anterior (0,4) sem reconstruir o elemento. Antes: MUTE-02/04 **FAIL**.
- Ícone, `aria-pressed`, `state.muted` e `el.muted` coerentes; "som bloqueado" aparece como silêncio (🔇) e não como 🔊.

## Limitações / por confirmar
- **UNCONFIRMED em hardware:** comportamento no Chrome sem automação e no SRAF Hisense.
- `el.muted === false` num elemento a tocar **não garante som audível** (volume do sistema, saída HDMI, política do dispositivo); a interface apenas deixa de afirmar som quando sabe que está silencioso.
- Browsers sem `navigator.userActivation`: tenta desmutar uma vez e verifica 300 ms depois; se o browser pausar, volta a mudo (um breve soluço possível).
- Ecrã sem supervisão após `MEDIA_PLAY_ERROR` fica em `PAUSED` até haver interacção (contrato mantido por decisão; ver `FINAL-REPORT.md`).
