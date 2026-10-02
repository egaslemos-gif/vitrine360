# PLAYER-PRO-02B — Implementação

Alteração de código: **2 ficheiros, ~25 linhas**.

| Ficheiro | Alteração |
|---|---|
| `src/domain/device-command.ts` | `COMMAND_REJECT_REASONS` + `"NOT_SUPPORTED"` (com comentário do significado). Aditivo |
| `src/player/command/command-dispatcher.ts` | Depois de `mapCommandToPlaybackAction` e antes de `controller.dispatch`: se `action.type` ∈ {PAUSE, STOP} e `controller.getState().currentContentType === "EXPERIENCE"` → `reject(command, "NOT_SUPPORTED")`, guarda no armazém de idempotência, emite `COMMAND_REJECTED`, devolve sem tocar no controlador |

Testes/scripts: `scripts/test-player-pro-02b.ts` (novo, 18 verificações) · `scripts/test-player-pro-02a.ts` (o antigo `KNOWN-GAP` passou a `PRO02A-006` e o seu teste de âmbito deixou de tratar `command-*` como protegido — o `PRO02B-S` cobre o âmbito completo) · `package.json` (`test:player-pro-02b`, na cadeia de `npm test`).

**Não alterados** (verificado por `PRO02B-S`: `git status`): `playback-controller.ts`, `playback-state.ts`, `command-mapping.ts`, `command-poller.ts`, `command-authorize.ts`, qualquer ficheiro `experience*`/sandbox/bridge/admission/`runtime/`, `public/tv.*`, rotas, BD/migrações, manifesto, modelo de repetição, interface local.

Decisões: guarda no dispatcher (fronteira do comando) e não no controlador, para não alterar a semântica de PAUSE/STOP de MEDIA nem o contrato do controlador; ACK `REJECTED` em vez de um novo `status`, para manter o enum do servidor; razão nova em vez de reutilizar `UNSUPPORTED_COMMAND` (ver auditoria).
