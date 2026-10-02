# PLAYER-PRO-01 — Plano de implementação (a autorizar)

Ordenado por **risco** (crescente) e **dependências**. Nenhum passo reescreve o `PlaybackController`, cria outro controlador/temporizador/fonte de verdade do índice, ou toca no runtime EXPERIENCE, no manifesto, no esquema da BD ou no `tv.js`.

| Passo | Causas | Alteração mínima | Ficheiros | Testes | Risco | Depende de |
|---|---|---|---|---|---|---|
| **1** | RC-02 | repor `seekAppliedRef` em `seeked`/mudança de geração | `playback-renderer-adapter.tsx` | probe E1; unitário (2 seeks iguais) | baixo | — |
| **2** | RC-01 | `ensureMediaPlayback` só quando o estado mais recente é `LOADING`/`PLAYING` (via `latestPlayback`) | `playback-renderer-adapter.tsx` (vídeo e áudio) | probe C2/C3 verdes; `test:react-player-live`; RP-01..07 | médio-baixo | — |
| **3** | RC-06, RC-07 (parte) | `PLAY_PAUSE`/`STOP` desactivados em EXPERIENCE; repetição visível em `compact`, rótulos PT, `aria-pressed` | `control-availability.ts`, `playback-controls.tsx` | RP-04 + novos asserts | baixo | — |
| **4** | RC-08, RC-09 | códigos de erro por `MediaError.code`/`canPlayType`; estado local "a carregar/buffering" (`waiting`/`playing`) | adaptador, `media-error-overlay.tsx`, `playback-controls.tsx` | RP-05 + unitários | baixo | 2 |
| **5** | RC-14 (base), RC-04 | reconciliação no adaptador: escutar `pause`/`playing`/`volumechange`; estado local `audioBlocked`; UI honesta (ícone/etiqueta "som bloqueado") | adaptador, chrome/controlos (prop/contexto) | SIM S1/S2 + unitários | médio | 2 |
| **6** | RC-03 | `ensureMediaPlayback`: nunca desmutar sem activação; listener de gesto sempre que o mudo foi forçado; no gesto `muted=false` + `play()`; remover a verificação síncrona frágil | `ensure-media-playback.ts` | SIM S1–S4 como asserts; Chrome real | médio | 5 |
| **7** | RC-05, política de recuperação | `usePlaybackRecovery`: watchdog de `PAUSED` por play-error e de `PLAYING` sem avanço (≥ 4 s) → 1 retry mudo → aguardar gesto `M` s → `MEDIA_ERROR` recuperável → caminho existente (1 retry + `NEXT`) | `use-playback-recovery.ts` (+ marcador mínimo no adaptador) | unitário do hook; probe SIM; soak | médio | 5, 6 |
| **8** | testes | promover a probe a `npm run test:player-pro-live` (opt-in, servidor local) e SIM como parte; adicionar teste estático `PRO-xxx` ao `npm test` (garantias de contrato); teste `SYNC_PLAYLIST` preserva `repeatMode` | `scripts/`, `package.json` | — | baixo | 1–7 |
| **9** | RC-12/13 | **validação física** em Hisense SRAF e 1 outra TV (checklist abaixo) | — | manual | — | 1–7 |

## Checklist de validação física (obrigatória antes de dar a fase por concluída)
1. Reiniciar a TV, abrir `/tv.html` (legacy) e `/player` (React) **sem tocar em nada**: o vídeo arranca? tem som? (anotar: modelo, firmware, versão do browser, codec do vídeo).
2. Deixar correr ≥ 3 ciclos completos da playlist (vídeo, imagem, áudio): continua no fim do último item?
3. Telecomando: Play/Pause/Stop/Seguinte/Anterior/FF/REW (keyCodes 415/19/413/417/412) e OK/setas.
4. Registar `localStorage["v360-tv-last-media-error"]` (legacy) e consola (React) em caso de falha.
5. Repetir com vídeo H.264 e (se aplicável) HEVC.

## Condição de aceitação da fase de implementação
Probe: 14/14 (sem defeitos C2, C3, E1) e SIM S1–S4 verdes · `npm test`, `tsc`, `build` verdes · lint = baseline (0 novos) · RP-01..07, EXPERIENCE-09/10/11, Content Templates, `test:player-reliability`, `test:react-player-live`, `test:tv-video-live` sem regressões · working tree limpo de timestamps incidentais · sem deploy sem autorização.

## Fora de âmbito (registado)
Pré-carga do item seguinte (RC-10), persistência de volume, cache IndexedDB como alternativa ao stream online, `ENDED` pausar o elemento, `F` duplicado, correcções dos 6 erros de lint pré-existentes e do aviso de hidratação do editor de playlists.
