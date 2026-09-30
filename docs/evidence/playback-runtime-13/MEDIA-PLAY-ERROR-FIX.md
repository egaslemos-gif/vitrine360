# MEDIA-PLAY-ERROR-FIX

## Contexto do Erro (O Bug Fatal)
Ao tentar evitar deadlocks do interface quando um autoplay falha, a implementação anterior (na flag PLAYBACK-RUNTIME-13) introduziu um workaround perigoso: em caso de `MEDIA_PLAY_ERROR`, o componente forçava o Player a executar `this.next()` imediatamente. 
Num caso de autoplay rejection (que emite a exceção `NotAllowedError`), uma política severa do browser poderia afetar uma playlist inteira de assets media, gerando um ciclo em loop extremamente veloz em que nenhum item conseguia carregar e a TV entrava em "busy looping" processando next-next-next infinitamente.

## Semântica e Contract Pass
- O comportamento foi corrigido retornando à especificação de contrato definida. 
- Quando `MEDIA_PLAY_ERROR` é apanhado via Promise rejection no wrapper `ensureMediaPlayback`, este reporta falha. O `RendererAdapter` expõe-no como `MEDIA_ERROR` (`recoverable: true`) para o controller.
- O controller reage isolando este branch condicional: `if (code === "MEDIA_PLAY_ERROR")`. Se isso acontecer, significa especificamente Autoplay falhado ou falha temporária em interagir com o dispositivo local. O status torna-se `PAUSED`.

## Resultado Final e Matriz Recuperada
- Autoplay Rejection (`NotAllowedError`) -> PAUSED.
- Recoverable play rejection -> PAUSED.
- Erros estritos como decoding corrompido, 404 (network fail) ou parsing inválido mantêm a flag para a UI renderizar o respetivo Alert (permanecendo no status `ERROR`).
- Retry (carregar em Play) tenta invocar o pipeline local no Media Element sem recriar a tree do player, de acordo com o lifecycle estrito do React e do RendererAdapter.
