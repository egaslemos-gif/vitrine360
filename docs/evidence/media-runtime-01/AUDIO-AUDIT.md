# MEDIA-RUNTIME-01: AUDIO AUDIT

## A Estratégia de AUDIO actual
Actualmente, o sistema renderiza itens do tipo `AUDIO` utilizando uma tag `<video>` configurada da seguinte forma:
```tsx
<video
  key={url}
  src={url}
  autoPlay
  muted={muted}
  preload="auto"
  controls={false}
  playsInline
  loop={loop}
  style={{ position: "absolute", width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }}
  aria-hidden
/>
```

## Porquê utilizar `<video>` e não `<audio>`?
Esta é a **estratégia actualmente utilizada** e documentada em código:
> We use `<video>` instead of `<audio>` because modern browsers (Chromium, Safari) strictly block muted `<audio>` autoplay, which breaks the playlist loop. `<video muted playsInline>` is permitted to autoplay.

Na reprodução autónoma ("digital signage"), a política de Autoplay dos browsers (especialmente Chromium e WebOS/VIDAA baseados em motores Chromium antigos) por vezes bloqueia a reprodução *audível* inicial se o utilizador não tiver interagido com o documento.
A função de segurança `ensureMediaPlayback` detecta falhas na reprodução e faz um *fallback* para tentar reproduzir *com som mudo* (`muted=true`), garantindo que a playlist continua a avançar e não "congela" devido à falta de interacção. 
No entanto, na nossa observação empírica (sem evidência comparativa conclusiva noutras engines além das testadas), o elemento `<audio muted>` provou-se insuficiente para contornar esses bloqueios em certas versões do WebKit/Chromium de Smart TVs. A estratégia `<video muted>` é mantida enquanto *workaround* prático para este ambiente.

## Respostas à Fase 8 (Checklist)
1. **Razão do AUDIO owner actual?** Fallback de Autoplay (`<video muted>`).
2. **Evidência no Hisense/VIDAA?** Sim, Smart TVs requerem interacção; falhar em reproduzir `<audio>` bloquearia todo o fluxo. `<video muted>` permite à playlist prosseguir, e a UI pode notificar o estado mutado.
3. **Reprodução duplicada?** Evitada pelo `disposeMediaElement` (ver `MEDIA-OWNER-AUDIT.md`).
4. **Dois media elements?** Não, apenas 1 element por geração (garantido no Adapter).
5. **Elemento anterior é effectively disposed?** Sim (`.removeAttribute('src')` e `.load()`).
6. **Hidden video produz efeitos visuais?** Não. É injectado com `opacity: 0.01`, `width: 1`, `pointer-events: none` num contexto fora de fluxo ou sobreposto pela interface principal de áudio (espectrograma `AudioVisual`).
7. **currentTime corresponde ao áudio?** Sim, `<video>` processa faixas apenas de áudio (MP3/WAV) reportando durações e timeupdates precisos.
8. **volume/mute funcionam?** Sim, são aplicados pelo `PlaybackController` → `PlaybackRendererAdapter` → `ensureMediaPlayback()`.
9. **play/pause/restart funcionam?** Sim, a tag comporta-se de forma equivalente.
10. **AUDIO → IMAGE limpa o elemento?** Sim, o `generation` bump acciona o `disposeMediaElement` do `<video>` antes do IMAGE.

**Conclusão:** A estratégia actual deve ser preservada. Alterar para `<audio>` introduziria regressões graves em situações de Autoplay.
