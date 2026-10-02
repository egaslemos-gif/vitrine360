# PLAYER-PRO-02 — Auditoria pré-implementação

Documentação PRO-01 lida integralmente e **confirmada contra o código actual** (commit `32a10ca`, working tree limpo antes de começar).

| Afirmação da auditoria PRO-01 | Confirmação no código | Nota |
|---|---|---|
| `ensureMediaPlayback` chamado sem olhar para o estado (6 handlers) | Confirmada (`loadedmetadata/loadeddata/canplay`, vídeo e áudio) | Corrigido |
| `seekAppliedRef` nunca reposto | Confirmada | Corrigido |
| `MEDIA_PLAY_ERROR` → `PAUSED` sem erro | Confirmada em `PlaybackController.onMediaError` | **Contrato mantido** (testes RP-05, PLAYBACK-CONTRACT) |
| `startMuted` desmuta sem gesto; verificação síncrona de pausa | Confirmada | Corrigido |
| EXPERIENCE com Play/Pause activo sem suspensão real | Confirmada (`experience-slide.tsx` não recebe estado; sem API de suspensão na bridge) | Controlo desactivado |
| Repetição: padrão `PLAYLIST`, rótulo inglês, oculto ≤768 px | Confirmada | UI corrigida; lógica **não** reaberta |
| Erros de media sempre `MEDIA_DECODE_ERROR`; `MEDIA_UNSUPPORTED` nunca emitido | Confirmada | Classificador novo |
| `logVideoDiag` escreve na consola em produção | Confirmada (incluía `error.message`) | Limitado a `development` |

Pontos novos descobertos nesta fase:
- O atributo `autoplay` do `<video>` pode iniciar a reprodução mesmo que o utilizador já tenha pausado durante o carregamento (o `pause()` do efeito só corria `if (!el.paused)`). Corrigido (pausa incondicional + `autoplay=false` ao montar em `PAUSED/STOPPED`).
- A sonda PRO-01 usava `ArrowRight` (+5 s) para o teste de seek em pausa, o que pode passar do fim da amostra e provocar `ended`; a comparação antes/depois foi feita com um teste novo e determinístico (`Home`).

## Baseline (antes de modificar código)
Herdada da PRO-01 sobre o mesmo commit: `npm test` exit 0 · `tsc` exit 0 · `eslint` 6 erros + 110 avisos · `next build` exit 0 · sonda PRO-01: **11/14** (defeitos C2, C3, E1) · simulação de política: S2/S3 defeito.

**Antes da correcção, no mesmo código-base**, o novo teste `live-player-pro-02-validate.ts` foi executado contra o build do commit original (src revertido por `git stash`) — resultado em `before-fix-live-results.txt`:
- `STOP-01` **FAIL** (STOPPED com `paused:false`, `cur=2.66`)
- `SEEK-01` **FAIL** (PAUSED com `paused:false`), `SEEK-01b` **FAIL**, `SEEK-02` **FAIL**
- `MUTE-02`, `MUTE-04`, `REP-01` **FAIL** (e o script abortou por falta do botão de repetição novo)
