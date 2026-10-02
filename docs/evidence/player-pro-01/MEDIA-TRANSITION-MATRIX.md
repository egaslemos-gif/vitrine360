# PLAYER-PRO-01 — Matriz de transições e estados

Legenda: **PROBE** = reproduzido em Chrome real nesta fase (`scripts/player-pro-01-probe.ts`); **TEST** = coberto por teste existente (`npm test` verde); **LIVE** = coberto por `test:react-player-live`/`test:tv-video-live` (RELIABILITY-01); **GAP** = sem teste automático; **SIM** = só em simulação de política.

> `GIF` = `IMAGE` com `image/gif` (não é `ContentType`). IMAGE→GIF e GIF→VIDEO usam o mesmo caminho `<img>` que IMAGE; **GAP** de teste específico no browser (existe `test:gif-3c` para o domínio/upload).

| Cenário | Cobertura | Observação |
|---|---|---|
| IMAGE → IMAGE | TEST (RP-02/03) | mesma geração nova, `<img onLoad>` → READY |
| IMAGE → GIF | GAP (browser) | igual a IMAGE→IMAGE |
| GIF → VIDEO | GAP (browser) | |
| IMAGE → VIDEO | PROBE (G: `1:still → …`) por ordem inversa; direção directa GAP | |
| VIDEO → IMAGE | **PROBE** | 0,9 s sem intervalo visível |
| VIDEO → AUDIO | GAP (na sonda: VIDEO→IMAGE→AUDIO) | |
| AUDIO → IMAGE | GAP | |
| AUDIO → VIDEO | **PROBE** | `LOADING` ≈ 0,3 s |
| AUDIO → AUDIO | GAP | |
| VIDEO natural → seguinte | **PROBE + LIVE** | avança no `ended` nativo, duração ≈ ficheiro |
| VIDEO com duração explícita → seguinte | **LIVE** | janela fixa com loop, ≈ 1,8× o ficheiro |
| Erro de carregamento (imagem/ficheiro 404) | TEST (RP-05) + LIVE (item avariado, retry + salto) | |
| Erro de descodificação | LIVE (MP4 truncado) | `MEDIA_DECODE_ERROR` |
| Autoplay bloqueado | **SIM** (S1–S4) | não reproduzível em Chrome automatizado |
| Retry após autoplay bloqueado | SIM (S4: Pause→Play) | automático: **não existe** para `PAUSED` por `MEDIA_PLAY_ERROR` |
| Playlist de 1 item | TEST (RP-02) | recarrega o ficheiro a cada volta (nova geração) — RC-10 |
| Playlist de vários itens | **PROBE** (3 itens, > 4 ciclos) | |
| Playlist vazia | TEST (RP-01/02) | `IDLE`, ecrã "NO CONTENT AVAILABLE" |
| Último → primeiro (`PLAYLIST`) | **PROBE + TEST** | |
| Fim de playlist (`NONE`) | TEST (RP-01) | `ENDED` |
| `ITEM` repete o item | TEST (RP-02) | |
| Mudança de manifesto durante a reprodução | TEST (RP-02/03 `SYNC_PLAYLIST`) | preserva geração quando o `playlistItemId` persiste |
| `NEXT`/`STOP` durante LOADING | GAP (sem teste dedicado; controlador defensivo, browser não testado) | STOP durante LOADING → `STOPPED` mas o `<video>` pode terminar de carregar e **retomar** (RC-01) |
| Eventos tardios de gerações anteriores | TEST (RP-01: `MEDIA_*` com geração antiga rejeitados) | elemento descartado na troca |
| Repetição de vários ciclos sem degradação | **PROBE** (≈ 4 ciclos, 75 s; um único elemento activo) | ciclos longos (horas): GAP — recomenda-se soak test |

## Falha terminal de um item pode bloquear a playlist indefinidamente?
- **`ERROR`**: não. `usePlaybackRecovery` repete **1 vez** (2,5 s) e depois faz `NEXT` (4,5 s). Se **todos** os itens falham, percorre a playlist em ciclo lento (≈ 7 s por item) sem rajadas. Limitado e sem recursão (LIVE: item avariado, ERROR máx. 6,6 s).
- **`LOADING`** parado: não. Watchdog de 30 s → `MEDIA_TIMEOUT` → mesmo caminho.
- **`PAUSED` por `MEDIA_PLAY_ERROR`**: **sim, indefinidamente** (nenhum temporizador actua).
- **`PLAYING` com elemento pausado** (RC-03): **sim, indefinidamente** — não há erro, logo nenhum mecanismo de recuperação.

### Política proposta (limitada, sem ciclos infinitos)
Observar a reprodução **física**: se `status === PLAYING` e o elemento estiver pausado/sem avanço de `currentTime` durante `N` s (p. ex. 4 s) → 1 tentativa de `play()` mudo; se falhar → marcar "som/reprodução bloqueados", esperar 1 gesto durante `M` s (p. ex. 15 s) e, se não houver, tratar como `MEDIA_ERROR` (recuperável) para entrar no caminho existente (1 retry + salto). Máximo 1 retry por item; o contador já existe em `usePlaybackRecovery`.
