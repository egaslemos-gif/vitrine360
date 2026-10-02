# PLAYER-PRO-02B — Contrato de comandos remotos para EXPERIENCE

## Regra
Se `controller.getState().currentContentType === "EXPERIENCE"` e a acção mapeada é `PAUSE` ou `STOP`:

| Aspecto | Resultado |
|---|---|
| `PlaybackState` | **inalterado** (nem `updatedAt`) |
| `generation` | inalterada |
| Controlador | nunca é chamado ⇒ nenhum listener é notificado ⇒ temporizador, renderer e experiência não são tocados |
| Experiência | continua montada e activa; o item avança pelo temporizador normal |
| ACK `status` | `REJECTED` (nunca `APPLIED`) |
| ACK `reason` | `NOT_SUPPORTED` (novo literal aditivo em `COMMAND_REJECT_REASONS`) |
| ACK `action` / `appliedAt` | `null` / ausente (não reporta execução) |
| Telemetria | `COMMAND_RECEIVED` + `COMMAND_REJECTED(reason=NOT_SUPPORTED)`; sem `COMMAND_APPLIED` |
| Idempotência | resultado guardado; repetição → `DUPLICATE` com `reason` preservado, nunca re-aplicado |

## O que não muda
- Todos os outros comandos em EXPERIENCE (`PLAY`, `NEXT`, `PREVIOUS`, `RESTART`, `SET_VOLUME`, `SET_MUTED`, `SET_REPEAT_MODE`) continuam `APPLIED` (testado).
- PAUSE/STOP para VIDEO, AUDIO, IMAGE, TEXT, CLOCK (e restantes) continuam `APPLIED` com estado idêntico ao do controlador directo (testado, comparação profunda de `PlaybackState`).
- A guarda segue o item **actual**: ao sair da EXPERIENCE (NEXT) PAUSE volta a aplicar-se; ao regressar, volta a ser rejeitado (testado).
- Ordem das verificações: idempotência → expiração → autorização → sessão → mapeamento → **guarda de tipo** → controlador. Um comando expirado/não autorizado continua com a sua razão original.
- Comandos de tipo desconhecido continuam `REJECTED/UNSUPPORTED_COMMAND`.

## Protocolo / compatibilidade
- Rota ACK (`POST /api/device/commands/[commandId]/ack`): `status` ∈ {APPLIED, REJECTED, DUPLICATE, EXPIRED, STALE_SESSION}; `reason` string ≤ 80 — `NOT_SUPPORTED` (13 caracteres) é aceite sem alterações. Sem migração. Clientes mais antigos que só conhecem o tipo TS antigo tratam `reason` como texto.
- Para o operador, o comando fica `REJECTED` com `resultReason = NOT_SUPPORTED` (visível onde já se mostra `resultReason`).

## Fora do contrato (inalterado de propósito)
Controlador, mapeamento de comandos, poller, runtime/admissão/sandbox/bridge de EXPERIENCE, interface local (já tratada na PRO-02), repetição, manifesto, BD.
