# PLAYER-PRO-02 — Stop e Seek (P0-A/B/C)

Chrome real (`channel: "chrome"`, `--autoplay-policy=document-user-activation-required`), servidor local com BD/armazenamento descartáveis. Script: `scripts/live-player-pro-02-validate.ts`. Resultados: `live-results-real.json`, `before-fix-live-results.txt`.

| Cenário | Antes (código original) | Depois |
|---|---|---|
| **STOP-01** Stop + `loadedmetadata`/`loadeddata`/`canplay`/`seeked` tardios (eventos sintéticos **e** o `canplay` nativo do `currentTime=0`) | **FAIL**: `STOPPED` mas `paused:false`, `cur=2.66` | **PASS**: `STOPPED`, `paused:true`, `cur=0` após 2,2 s |
| STOP-02 Play depois de Stop | PASS | PASS (`PLAYING`, `paused:false`) |
| **SEEK-01** PLAY→PAUSE→SEEK(Home)→eventos tardios→esperar | **FAIL**: `PAUSED` com `paused:false`, tempo a avançar (0,44 → 2,25) | **PASS**: `PAUSED`, `paused:true` |
| SEEK-01b posição aplicada e sem avanço | **FAIL** | **PASS**: 3,66 s → 0 → 0 (sem deriva) |
| **SEEK-02** Home, avançar ≥ 1,5 s, Home outra vez (mesma posição) | **FAIL** (2.º ignorado; na sonda PRO-01: 3,35 s → 4,26 s) | **PASS**: 0,65 → 3,16 → 0,65 |

Sonda PRO-01 (a mesma de antes): **11/14 → 14/14** (C2, C3, E1 resolvidos). Nota: o seek em pausa da sonda passou a usar `Home` em vez de `ArrowRight` para não ultrapassar o fim da amostra.

## Porque ficou correcto
- Os eventos nativos só iniciam reprodução se o controlador estiver em `LOADING/PLAYING` **na geração do elemento** (`startIfWanted`); em `STOPPED/PAUSED/ENDED/ERROR/IDLE` ou geração antiga são ignorados.
- `pause()` é sempre chamado em `PAUSED/STOPPED` (cancela também um `autoplay` pendente).
- O seek só deduplica enquanto está em curso (`seeked` limpa) e nunca compara com um seek concluído; não há ciclo seek ↔ evento ↔ play (o evento já não chama play fora de `LOADING/PLAYING`).
- Unitário: `PRO02-003` (STOP não é desfeito por eventos da mesma geração), `PRO02-005` (contrato `SEEK`: limitado, finito, nunca muda o estado).
