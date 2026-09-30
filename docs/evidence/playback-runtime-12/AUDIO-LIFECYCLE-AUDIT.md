# AUDIO LIFECYCLE

**React Player**:
Em `audio-visual.tsx`, o AUDIO é renderizado com uma `<video>` oculta (para mitigar políticas de autoplay em browsers modernos Chromium/Safari).
```ts
<video style={{ position: "absolute", width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }} />
```
No `Slide`, aquando do unmount (quando a playlist avança para IMAGE ou VIDEO), o `useEffect` return handler é disparado:
```ts
useEffect(() => {
  return () => {
    const el = localMediaRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        // ignore
      }
    }
  };
}, []);
```
Este `useEffect` garante o `pause` e clear de `src`, forçando o `load()`, libertando o stream de áudio, desvinculando-o do hardware.

No Legacy TV, a limpeza similar acontece imperativamente em `stopAudioElement`.

**CONCLUSÃO**: O lifecycle está teoricamente robusto. Se o áudio "continua tocando", as suspeitas recaem sobre: 
1. React não executar unmount do `<Slide>` (improvável se o `key` / `generation` muda), ou 
2. Hisense / SRAF ter um leak nativo onde `pause()` e `src=""` e `load()` na tag `<video>` ainda deixa a stream presa no OS decoder, caso não se remova do DOM. 
Porém, no DOM o `Slide` sai da DOM tree no unmount.
