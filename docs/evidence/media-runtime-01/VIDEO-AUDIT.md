# MEDIA-RUNTIME-01: VIDEO AUDIT

## Mecanismos de Temporização do VIDEO

O sistema define duas possibilidades de tempo para vídeo (`resolveEffectiveDuration`):
1. **VIDEO NATURAL (0):**
   - Não inicializa `PresentationTimer`.
   - Espera unicamente pelo evento nativo `onEnded` gerado pelo `HTMLVideoElement`.
   - Quando o `onEnded` é disparado, chama `onMediaEvent({ type: "MEDIA_ENDED", generation })`.

2. **VIDEO FIXED (> 0):**
   - Inicializa `PresentationTimer` no `PlaybackRendererAdapter`.
   - Ignora o evento nativo `onEnded` (`nativeEnded === false`).
   - O Timer chama `controller.tickImageElapsed`, que por sua vez faz `onMediaEnded(generation)` assim que a duração definida é alcançada.

## Prevenção de Dupla Progressão (Double NEXT)
Na Fase 4 do plano, foi requerida uma protecção para que o timer e o ended nativo não avançassem a playlist duas vezes.
Esta arquitectura já previne a dupla progressão através de dois vectores:
1. **Filtragem Lógica:** O callback `onEnded` no `<video>` verifica `if (nativeEnded)`. Uma vez que `nativeEnded` só é verdadeiro quando a duração definida é 0, o evento nunca dispara para um vídeo FIXED.
2. **Geração Estrita:** Mesmo que algum evento residual escapasse, `controller.onMediaEnded(generation)` só transita a playlist de estado `PLAYING` para `LOADING`. Qualquer chamada subsequente com a mesma geração falharia porque o estado já não seria `PLAYING`.

## Media Lifecycle (Fase 9)
O sistema já contempla instrumentação abrangente via a função `logVideoDiag("loadstart")`, `logVideoDiag("playing")`, etc., imprimindo no console informações críticas (estado da rede, erros de codec, dimensões, etc.) de forma prefixada com `[VIDEO-DIAG]`.

## Erros (Fase 10)
A rejeição na promessa do método `.play()` ou do evento `onError` é encapsulada em `MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR` (ou `MEDIA_DECODE_ERROR`). Estes erros acedem ao Controller, que coloca o player em `PAUSED` ou `ERROR`, aguardando Recovery/Retry, cumprindo plenamente o `PLAYBACK-CONTRACT-01`. Não existe transição automática para o próximo item (`NEXT`) em caso de erro, garantindo que o media não salta em loop descontrolado.
