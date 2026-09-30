# RETRY-VALIDATION

## Objetivos da Política de Retry

1. **Reutilizar Elementos DOM Subjacentes**: O instanciamento de instâncias `<video>` no browser, especialmente em ecossistemas fechados (como browsers embebidos SRAF/Tizen), consome hardware buffers caros. Uma tentativa de "retry" cega através da destruição e recriação do componente poderia encravar os buffers físicos em segundos.
2. **Ciclo Curto**: Ao reportar um `MEDIA_PLAY_ERROR`, o componente do React (Slide + Renderer) nunca perde o pointer para o seu Media Element ativo porque não ocorrem mudanças na key (`generation`).
3. **Ativação Segura**: Ao permanecer na flag `PAUSED`, uma ação posterior de `PLAY` engatilha o retry sobre esse exato contexto local que permanece quente em cache.

## Testes Relevantes (MEDIA-054-X)

- **MEDIA-054-F**: `PAUSED autoplay retry`. Certifica que carregar "Play" retira a aplicação de `PAUSED` para `PLAYING` num erro explícito de Autoplay.
- **MEDIA-054-G**: `No media element reconstruction for PAUSED retry`. Confirma pelo lifecycle isolado no `currentContentId` que a mesma instância de slide não foi forçada a re-renderizar, logo não houve unmount do Media Element antigo nem instanciamento do novo. O `sameElement` permanece intacto.
- **MEDIA-054-H**: `Existing playback progression unaffected`. Confirma que `positionMs` se mantém.

O sistema validou assim a política exigida de Single Media Owner mesmo em caso de erro, evitando a armadilha de um "segundo player paralelo".
