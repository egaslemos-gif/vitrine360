# PLAYER-PRO-02 — Controlos, buffering, erros e repetição (P1-B, P2-A, P2-B)

## EXPERIENCE (P1-B)
- `control-availability.ts`: Play/Pause e Stop **desactivados** para `EXPERIENCE`; Anterior/Seguinte/Repetição/Ecrã inteiro mantêm-se. Teclado (Espaço, `MediaPlayPause`, `MediaStop`, keyCodes 415/19/413) ignorado para EXPERIENCE.
- Motivo: o sandbox/bridge não tem API de suspensão; pausar só o temporizador do playlist seria uma pausa fictícia (o conteúdo continuaria a correr).
- **Não** foram tocados: admissão, sandbox, bridge, origem, permissões (EX-09/10/11 verdes). Verificado em unitário (`PRO02-009`: IMAGE/VIDEO/AUDIO/TEXT/CLOCK mantêm Play/Pause e Stop). **Não** houve teste de browser com um pacote EXPERIENCE real nesta fase.

## Buffering (P2-A)
- Só quando observável: `waiting`/`stalled` **com `readyState < 3`**, elemento não pausado e estado `PLAYING`; limpa em `playing`/`canplay`/`seeked`/`timeupdate` (com `readyState ≥ 3`). Estado `LOADING` do controlador também mostra "A carregar…".
- Chrome real, com eventos sintéticos e `readyState=2`: `BUF-01` **PASS** (nota aparece e desaparece); `BUF-02` **PASS** (`waiting` num elemento saudável **não** afirma buffering).
- **Limite:** não foi simulada degradação real de rede (throttling) nem uma TV.

## Classificação de erros (P2-A)
`classifyMediaError` (`media-types.ts`), testes `PRO02-011`:
| Entrada | Código | Tipo |
|---|---|---|
| `MediaError.code` 2 | `MEDIA_LOAD_ERROR` | rede |
| 1 (aborto) | `MEDIA_LOAD_ERROR` | carregamento |
| 3 | `MEDIA_DECODE_ERROR` | descodificação |
| 4 | `MEDIA_UNSUPPORTED` | formato não suportado |
| sem código, `navigator.onLine=false` | `MEDIA_LOAD_ERROR` | rede |
| sem informação | `MEDIA_ERROR` | desconhecido |
Autoplay bloqueado **não** é erro (notas de UI acima); timeout continua `MEDIA_TIMEOUT` (watchdog 30 s, inalterado). Mensagem ao utilizador via `userFacingMediaErrorMessage` (inalterada, compatível com RP-05) + nota PT por tipo nos controlos. Nenhum URL, token, cookie, stack ou `error.message` do browser é transmitido (verificado em `PRO02-011`); a consola de diagnóstico de vídeo passou a `development` apenas. Contratos de erro do controlador **inalterados**, só os códigos emitidos pelo adaptador ficaram mais precisos.

## Repetição (P2-B)
- Evidência (sem reabrir a lógica): `PRO02-013`/`014` — `PLAYLIST` padrão no estado inicial e no controlador; último→primeiro; `ITEM` mantém o item; `NONE` termina em `ENDED`; `SYNC_PLAYLIST` preserva modo e item. Sonda PRO-01 G2: ≥ 4 ciclos.
- Interface (Chrome real): `REP-01` rótulo "Repetição: repetir lista", `aria-pressed=true`; `REP-02` ciclo lista → item → sem repetição (`aria-pressed=false`) → lista; `REP-03` a 600 px de largura o controlo existe e mede ≥ 36 × 36 px (49,7 × 36).
- Texto curto visível junto ao ícone (`Lista`/`Item`/`Off`) para não depender só do símbolo.

## Não alterado nesta fase
Restantes rótulos em inglês (`Play`, `Pause`, `Stop`, `Retry`) por compatibilidade com testes RP-04/05; redesenho visual (fora de âmbito).
