# PLAYER-PRO-02B — Testes de comandos remotos

`npm run test:player-pro-02b` — **18/18 PASS** (na cadeia de `npm test`). Usa o **dispatcher real**, o **PlaybackController real** e o **CommandPoller real**; o corpo do ACK é capturado do `fetch` do próprio poller (nada substitui a lógica avaliada). Não houve teste de browser com EXPERIENCE real: não existe caminho de API admin para criar conteúdo EXPERIENCE nem fixture de browser; o transporte HTTP do servidor foi validado por contrato (rota ACK).

| ID | Cenário | Resultado |
|---|---|---|
| A | EXPERIENCE + PAUSE: `status REJECTED`, `reason NOT_SUPPORTED`, `action null`, sem `appliedAt`; `getState()` **deepEqual** ao anterior (inclui geração e `updatedAt`); 0 notificações do controlador; continua `PLAYING` e EXPERIENCE; telemetria `RECEIVED`+`REJECTED`; repetição → não `APPLIED`, mesma razão, estado igual | PASS |
| B | EXPERIENCE + STOP: idem | PASS |
| A2 | EXPERIENCE continua a aceitar PLAY, NEXT, PREVIOUS, RESTART, SET_VOLUME, SET_MUTED, SET_REPEAT_MODE (`APPLIED`) | PASS |
| A3 | A guarda segue o item actual: EXPERIENCE→NEXT→IMAGE: PAUSE `APPLIED`/`PAUSED`; de volta à EXPERIENCE: STOP `NOT_SUPPORTED`, `PLAYING` | PASS |
| C-VIDEO/AUDIO/IMAGE/TEXT/CLOCK | PAUSE: `APPLIED`, `action PAUSE`, `PlaybackState` **idêntico** ao de um `controller.dispatch(PAUSE)` directo | PASS ×5 |
| D-VIDEO/AUDIO/IMAGE/TEXT/CLOCK | STOP: `APPLIED`, estado idêntico ao controlador directo, `STOPPED` | PASS ×5 |
| P1 | `NOT_SUPPORTED` está em `COMMAND_REJECT_REASONS`; tipo desconhecido continua `UNSUPPORTED_COMMAND` | PASS |
| P2 | Rota ACK: `reason: z.string().max(80)`; `REJECTED` ∈ `ACK_RESULT_STATUSES` | PASS |
| W | Poller real: EXPERIENCE PAUSE/STOP → POST ACK `{status:"REJECTED", reason:"NOT_SUPPORTED"}`, estado `PLAYING`; VIDEO PAUSE → ACK `APPLIED`, `reason:null`, `PAUSED` | PASS |
| S | Âmbito: nenhum ficheiro protegido (EXPERIENCE/sandbox/bridge/admission/runtime/controlador/estado/mapeamento/poller/tv.js/BD) alterado | PASS |

Relacionados: `test:player-pro-02a` 6/6 (inclui `PRO02A-006`: antigo `KNOWN-GAP`, agora com o dispatcher real → `REJECTED/NOT_SUPPORTED`, estado igual).
