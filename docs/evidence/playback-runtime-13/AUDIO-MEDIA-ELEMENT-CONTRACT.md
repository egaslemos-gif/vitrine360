# AUDIO MEDIA ELEMENT CONTRACT

## Implementação Atual

Em `src/player/playback/playback-renderer-adapter.tsx`, quando `item.type === "AUDIO"`, a engine constrói e exibe o componente puramente decorativo `<AudioVisual />` e insere de forma invisível um elemento `<video>` mutado em vez de `<audio>`.

```tsx
  if (item.type === "AUDIO" && url) {
    return (
      <div style={{ position: "absolute", inset: 0 }} data-media-kind="audio">
        <AudioVisual ... />
        {/* We use <video> instead of <audio> because modern browsers (Chromium, Safari) strictly block muted <audio> autoplay, which breaks the playlist loop. <video muted playsInline> is permitted to autoplay. */}
        <video
          key={url}
          src={url}
          autoPlay
          muted={true}
          playsInline
          ...
```

## Por que HTMLVideoElement e não HTMLAudioElement?

1. **Motivo e Benefícios (Workaround de Autoplay)**: Browsers modernos (WebKit/Chromium e consequentemente os runtimes baseados neles nas Smart TVs, como WebOS, SRAF na Hisense Vidaa e Tizen) aplicam políticas extremamente rígidas ao `autoplay` de conteúdo sonoro. No entanto, elementos `<video>` contendo o atributo explícito `muted` têm permissão quase universal para efetuar `autoplay`. Ao utilizarmos um `<video muted playsInline>` e reproduzindo uma source de áudio, conseguimos garantir o arranque automático do componente. Se fosse um `<audio>`, ele paralisaria a playlist em ambientes onde não houve interação prévia (boot frio).

2. **Limitações**: Esta abordagem significa que não existirá áudio até que ocorra interação (ex: um botão forçar `unmute`). Num cenário puramente visual, isso é aceitável, e a lógica do `ensureMediaPlayback` está especificamente desenvolvida para tentar reverter este estado logo após o play se for desejável.

3. **Hisense Compatibility**: O motor SRAF do Hisense não suporta criação instável de domínios ou tags que violam o memory layout do codec decodificador. Ao centralizar o pipeline sempre em `<video>`, abstraímos se a engine está a instanciar um decodificador híbrido.

## Verificação de Concorrência e Single Media Owner

- Na árvore DOM do Player, todos os assets dependem do `PlaybackRendererAdapter`.
- O adaptador monta apenas uma `Slide` principal ancorada pela `generation`.
- `document.querySelectorAll("audio")` retorna NULO dentro da interface do Vitrine360.
- `document.querySelectorAll("video")` devolverá exatamente **1** elemento correspondente ao vídeo atual ou ao stub invisível de áudio em reprodução.
- Quando acontece um `NEXT`, o componente Slide desmonta o `<video>` antigo antes de montar a `Slide` para a próxima `generation`, invocando o `disposeMediaElement()` rigorosamente.

## Conclusão
- Audio pipeline é mapeado para **HTMLVideoElement** isolado.
- Nenhum `HTMLAudioElement` é utilizado no caminho crítico.
- O invariante **SINGLE MEDIA OWNER** é respeitado na árvore React, sendo a reciclagem dos elementos delegada à reconciliação do React combinada com a ação imperativa de `disposeMediaElement()` aquando do *unmount*.
