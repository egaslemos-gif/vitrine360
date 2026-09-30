# CONTROL AUTHORITY

Fluxo:
UI (`playback-controls.tsx`) -> `dispatch({ type: "NEXT" })` -> `PlaybackController` altera estado -> re-render `PlaybackRendererAdapter` -> re-monta `<Slide>` -> `ensureMediaPlayback()` ou define properties (`volume`, `muted`, etc.).

Nenhuma UI interage diretamente com referências DOM de mídia:
```ts
// Não há UI -> video.play()
```
Apenas `PlaybackRendererAdapter` manipula `HTMLMediaElement`. E apenas os DOM Event Listeners (`onEnded`, `onError`, `onTimeUpdate`) devolvem eventos ao controlador, sempre guarnecidos pelo token de `generation`.

**CONCLUSÃO**: Cadeia de autoridade impecável. Nenhuma quebra (`CONTROL-PATH-BREAK`) detectada no React Player. O estado dita a DOM.
