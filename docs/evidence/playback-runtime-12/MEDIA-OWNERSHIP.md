# MEDIA OWNERSHIP

**Regra Principal**: Deve existir um único proprietário.

## React Player
- **Criação**: `PlaybackRendererAdapter.tsx`
- **Montagem**: Montado no `Slide` durante o ciclo de renderização.
- **Desmontagem**: Removido quando a chave `rendererKey` muda (combinação de `playlistItemId` + `contentId` + `generation`).
- **play() / pause()**: Controlado pelo `useEffect` no `PlaybackRendererAdapter` e chamadas `ensureMediaPlayback(el, ...)`.
- **src**: Definido no `Slide` `useEffect` que busca da BD ou blob.
- **load()**: Invocado indiretamente por alteração de src; também em desmontagem de `localMediaRef`.
- **Revocação de URL**: `URL.revokeObjectURL(revoked)` no cleanup do `useEffect`.
- **Events**: `onLoadedMetadata`, `onTimeUpdate`, `onEnded`, `onError` disparam eventos (`MEDIA_READY`, `MEDIA_TIME_UPDATE`, `MEDIA_ENDED`, `MEDIA_ERROR`) despachados pelo `PlaybackController`.
- **Geração**: Adicionado `generation` em todas as chamadas `onMediaEvent` para evitar stales.

## Legacy Player (`tv.js`)
- **Criação**: `document.createElement("video")` ou inline.
- **Desmontagem**: `stopVideoElement()` / `stopAudioElement()`.
- **play() / pause()**: `playVideoElement()`, `playAudioElement()`.

**CONCLUSÃO**: Não há evidência de múltiplos proprietários simultâneos no código fonte do React. O `PlaybackRendererAdapter` garante que apenas o `Slide` ativo para uma dada `generation` detenha a `<video>` ou `<img>`. O legacy player e o react player estão isolados em rotas separadas.
