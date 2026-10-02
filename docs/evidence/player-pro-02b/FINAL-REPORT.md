# PLAYER-PRO-02B — Relatório final

## Veredicto: **VALIDATED**
O desvio PRO-02A (`KNOWN-GAP`: PAUSE/STOP remotos aceites numa EXPERIENCE) está **resolvido**. **PLAYER-PRO-02 fica pronta para revisão final pré-commit.**

## Resultado
Comandos remotos `PAUSE`/`STOP` com a EXPERIENCE como item actual são agora respondidos `REJECTED` com `reason: "NOT_SUPPORTED"`, sem tocar no `PlaybackController`: estado, geração e `updatedAt` idênticos, nenhum listener notificado (logo temporizador, renderer e experiência intactos), sem `appliedAt`, sem acção reportada. MEDIA (VIDEO, AUDIO, IMAGE, TEXT, CLOCK) mantém exactamente o comportamento anterior. Os restantes comandos continuam a ser aplicados a EXPERIENCE.

## Protocolo
Compatível sem extensão incompatível: `REJECTED` já existe no ACK; `reason` é string livre (≤ 80) no servidor. Acrescentado apenas o literal TypeScript `"NOT_SUPPORTED"` (aditivo). Não foi necessário parar por limitação de protocolo.

## Alterações
`src/domain/device-command.ts` (+1 razão) · `src/player/command/command-dispatcher.ts` (+guarda). Nada mais em `src/`. Testes: `scripts/test-player-pro-02b.ts` (18), `scripts/test-player-pro-02a.ts` (gap → `PRO02A-006`), `package.json`.

## Critérios
| Critério | Resultado |
|---|---|
| A. EXPERIENCE+PAUSE sem alterar estado/geração, experiência activa, ACK `NOT_SUPPORTED` | PASS |
| B. EXPERIENCE+STOP idem | PASS |
| C/D. MEDIA PAUSE/STOP preservados (estado idêntico ao controlador directo) | PASS (5 tipos × 2) |
| E. STOP durante carregamento, eventos de gerações antigas | PASS (13/13; 17/17) |
| EX-09/10/11, Content Templates, RP-01..07/09, PRO-02 e suites relacionadas | PASS (`npm test` exit 0) |
| tsc / build / lint | exit 0 / exit 0 / baseline 116 (0 novos) |
| Runtime EXPERIENCE, admissão, sandbox, bridge, controlador, BD, manifesto, repetição, interface local | **não alterados** |
| Commit / push / deploy / Production | **nenhum** |

## Limitações
- Sem teste de browser com EXPERIENCE real e sem ACK real contra o servidor com um dispositivo emparelhado: o dispatcher e o poller reais foram exercitados com `fetch` injectado (corpo do ACK capturado) e o contrato da rota foi verificado estaticamente. Não existe forma de criar conteúdo EXPERIENCE por API admin nem fixture de browser.
- O operador verá o comando como `REJECTED` / `NOT_SUPPORTED`; a apresentação dessa razão na consola de administração não foi alterada nem testada.
- `test:tv-video-live` mostrou uma falha intermitente de medição (`TV-DURATION-01`) em ficheiros não tocados — ver `REGRESSION.md`.
- Continua **sem validação física** de Smart TV (Hisense SRAF ou outra) — ver `docs/evidence/player-pro-02/PHYSICAL-TV-CHECKLIST.md`.
