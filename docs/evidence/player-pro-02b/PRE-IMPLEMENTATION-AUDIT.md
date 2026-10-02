# PLAYER-PRO-02B — Auditoria pré-implementação

Confirmada contra o código actual (não contra a documentação).

## Percurso real de um comando remoto
```
Admin  POST /api/admin/devices/[id]/commands   (zod: type ∈ DEVICE_COMMAND_TYPES, binding, payload…)
  → services/device-commands (persistência, estado do comando)
Device GET  /api/device/commands               (poll; claim)            ← src/player/command/command-poller.ts
  → CommandDispatcher.dispatch(command)        ← src/player/command/command-dispatcher.ts
        1 idempotência (commandId já visto → DUPLICATE + resultado anterior)
        2 expiração (isCommandExpired → EXPIRED)
        3 autorização alvo/tenant/dispositivo/permissão (authorizeDeviceCommand → REJECTED/<reason>)
        4 ligação à sessão (SESSION_BOUND → STALE_SESSION / DEVICE_MISMATCH / WRONG_TENANT)
        5 mapCommandToPlaybackAction (tipo desconhecido → throw → REJECTED/UNSUPPORTED_COMMAND)
        6 controller.dispatch(action)          ← PlaybackController          → APPLIED
  → poller: POST /api/device/commands/[commandId]/ack  { status, sessionId, reason|null, observedAt }
        rota: zod status ∈ ACK_RESULT_STATUSES, reason: string ≤ 80 (livre); persistido em resultReason
```
O mesmo `createCommandDispatcher` é usado em `src/features/player/player-app.tsx` (produção) e em `src/app/player/lab/lab-client.tsx` (lab).

## Formato e semântica do ACK (`CommandResult`)
`{ commandId, status ∈ APPLIED|REJECTED|EXPIRED|DUPLICATE|STALE_SESSION, deviceId, sessionId, action: DeviceCommandType|null, appliedAt?, reason?: CommandRejectReason, correlationId? }`.
- `APPLIED` ⇒ `action` preenchido e `appliedAt` definido. Qualquer rejeição ⇒ `action: null`, sem `appliedAt`, `reason` preenchido, resultado guardado no armazém de idempotência (um repetido devolve `DUPLICATE` com o resultado anterior).
- Razões existentes: INVALID_STRUCTURE, UNSUPPORTED_COMMAND, INVALID_PAYLOAD, WRONG_TENANT, UNKNOWN_DEVICE, DEVICE_MISMATCH, STALE_SESSION, EXPIRED, UNAUTHORIZED, COMMAND_TOO_LARGE, NOT_AUTHORIZED. **Não existia `NOT_SUPPORTED`.** `UNSUPPORTED_COMMAND` significa "tipo de comando desconhecido para este dispositivo" (falha de mapeamento).

## Identificação inequívoca do conteúdo actual
`PlaybackController.getState().currentContentType` (derivado de `parseContentType(item.type)` em `applyItemAt`) — definido logo que o item é seleccionado (`LOADING`, `PLAYING`…), `null` apenas em `IDLE`. Já era a fonte usada por `control-availability` e pelo teclado.

## Comportamento actual por tipo
O dispatcher **não distinguia tipos**: PAUSE/STOP chegavam ao controlador para qualquer conteúdo. VIDEO/AUDIO: `PAUSED`/`STOPPED` + efeitos no elemento (adaptador). IMAGE/TEXT/CLOCK/NOTICE/EVENT/NEWS/QR_CODE: o temporizador de apresentação pára/reinicia (pausa real da *apresentação*). **EXPERIENCE: o controlador passava a `PAUSED`/`STOPPED` enquanto o iframe sandboxed continuava a correr** (reproduzido em PRO-02A, `KNOWN-GAP`).

## Transições permitidas (inalteradas)
`canTransition`: PLAYING→PAUSED/STOPPED permitidos para qualquer tipo; nada no controlador depende do tipo. Por isso a guarda tem de estar no dispatcher (fronteira do comando), não no controlador.

## Decisão sobre `NOT_SUPPORTED`
O protocolo suporta a resposta de forma compatível: `status: "REJECTED"` já é um estado ACK válido no servidor e `reason` viaja como **string livre (≤ 80)**; o único acoplamento é o tipo TypeScript `CommandRejectReason`. Acrescentar o literal `"NOT_SUPPORTED"` é uma extensão **aditiva** (sem migração, sem alteração de rota, de BD ou de consumidores — nenhum `switch` exaustivo sobre a razão existe em `src/` ou `scripts/`). Reutilizar `UNSUPPORTED_COMMAND` foi rejeitado por ambiguidade (já significa "tipo desconhecido") e para o operador poder distinguir "não suportado por este conteúdo" de "dispositivo não conhece o comando". Condição de paragem do pedido ("se o protocolo não suportar NOT_SUPPORTED") **não se verifica**.
