# PLAYER-PRO-01 — Pré-auditoria (baseline)

## Estado exacto antes da auditoria
- Commit: `32a10ca7e7f033d3e668362c39afaa10012e982e` (`feat(ui): rectangular player screen and fuller desktop hero`), branch `main`, working tree limpo (`git status` vazio).
- Nenhum ficheiro de código funcional foi alterado nesta fase. Novos ficheiros (apenas evidência/diagnóstico): `docs/evidence/player-pro-01/*`, `scripts/player-pro-01-probe.ts`.

## Baseline de testes (antes de qualquer alteração)
| Verificação | Resultado |
|---|---|
| `npm test` (cadeia completa: RP-01..07, RUNTIME-PLAYBACK-09, EXPERIENCE-09/10/11, Content Templates, PLAYER-RELIABILITY-01 …) | **exit 0** |
| `tsc --noEmit` | **exit 0** |
| `eslint .` | 116 problemas = **6 erros + 110 avisos** (baseline conhecida: `dump.ts`, refs no adaptador linhas 123-127). Os ficheiros novos desta fase estão limpos |
| `next build` | ver `FINAL-REPORT.md` (executado no fim, sem alterações funcionais) |

Os scripts de teste reescrevem carimbos de data em 18 documentos de evidência; foram repostos **ficheiro a ficheiro** (`git checkout -- <ficheiro>`), sem tocar em mais nada.

## Mapa real dos ficheiros (os caminhos do pedido diferem do repositório)
| Pedido | Caminho real |
|---|---|
| `playback-controller.ts` | `src/player/playback/playback-controller.ts` |
| `domain/playback-state.ts` | `src/domain/playback-state.ts` (+ `src/domain/playback-timing.ts`) |
| `ensure-media-playback.ts` | `src/player/playback/ensure-media-playback.ts` |
| Renderer Adapter | `src/player/playback/playback-renderer-adapter.tsx` |
| `playback-controls.tsx` / `playback-chrome.tsx` | `src/player/playback/…` (não `src/player/`) |
| `display-engine.tsx` | `src/player/playback/display-engine.tsx` |
| Recuperação (novo em RELIABILITY-01) | `src/player/playback/use-playback-recovery.ts` |
| Teclado | `src/player/playback/use-playback-keyboard.ts` |
| Disponibilidade dos controlos | `src/player/playback/control-availability.ts` |
| Runtime | `src/player/runtime/` (`fullscreen.ts`, `cursor-idle.ts`, `shell.tsx`, …) |
| App do player | `src/features/player/player-app.tsx` |
| Legacy TV | `public/tv.js`, `public/tv.html` (não alterados) |

Observação de arquitectura relevante: **não existe `HTMLAudioElement`**. O áudio usa um `<video>` invisível (1×1 px) por causa da política de autoplay (comentário no adaptador). Todo o diagnóstico de "áudio" é portanto feito sobre um `HTMLVideoElement`.

## Metodologia
1. Leitura integral do controlador, do estado de domínio, do `ensureMediaPlayback`, do adaptador (1018 linhas), do chrome, dos controlos, do teclado, da recuperação e do `playback-timing`.
2. Sonda de browser (`scripts/player-pro-01-probe.ts`) em **Chrome real**, com `--autoplay-policy=document-user-activation-required` e instrumentação injectada **por fora** (`addInitScript`, ficheiro `instrument.js`; sem alterar o código da aplicação; tokens mascarados). Os testes anteriores forçavam `no-user-gesture-required`, o que escondia defeitos de autoplay.
3. Modo `SIM_POLICY=1`: emula a política de autoplay do Chrome/Chromium TV (play() com som rejeitado sem gesto; "desmutar" sem gesto pausa o elemento), porque o Chrome automatizado **não aplica** a política (ver `AUDIO-VIDEO-DIAGNOSTICS.md`). Resultados da simulação são sempre identificados como tal.
4. BD e armazenamento descartáveis (`authz02-e2e.db`, local); nada contra dados reais; sem deploy; Production intocada.
