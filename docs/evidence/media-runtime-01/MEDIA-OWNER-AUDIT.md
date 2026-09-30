# MEDIA-RUNTIME-01: MEDIA OWNER AUDIT

## Objetivo
Garantir o invariante `activeMediaCount <= 1` em todo o ciclo de vida do Player. Evitar que elementos antigos continuem a consumir recursos ou reproduzir áudio/vídeo sobrepostos.

## Auditoria ao Código Actual

### 1. Limpeza Baseada na Geração
No ficheiro `src/player/playback/playback-renderer-adapter.tsx`:
```tsx
  if (prevGenerationRef.current !== generation) {
    prevGenerationRef.current = generation;
    if (mediaRef.current) {
      disposeMediaElement(mediaRef.current);
      mediaRef.current = null;
    }
  }
```
Esta é a defesa primária. Cada transição de item avança o valor de `generation` do `PlaybackController`. Sempre que a React detecta uma nova `generation`, a função chama synchronously `disposeMediaElement` no `mediaRef.current` antigo antes de tentar montar qualquer novo `<Slide>`.

### 2. Ciclo de Vida do Slide
Adicionalmente, o próprio componente `<Slide>` invoca a limpeza quando é desmontado:
```tsx
  useEffect(() => {
    return () => {
      if (localMediaRef.current) {
        disposeMediaElement(localMediaRef.current);
      }
    };
  }, []);
```

### 3. Função de Disposição (`disposeMediaElement`)
```typescript
export function disposeMediaElement(el: HTMLMediaElement | null | undefined) {
  if (!el) return;
  try {
    el.onended = null;
    el.onerror = null;
    el.ontimeupdate = null;
    el.onloadeddata = null;
    el.onloadedmetadata = null;
    el.oncanplay = null;
    el.onplay = null;
    el.onplaying = null;
    el.onpause = null;

    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch { /* ignore */ }
}
```
A função:
1. Elimina callbacks pendentes, garantindo que nenhum callback tenta alterar o estado após o elemento ser removido.
2. Faz `.pause()`.
3. Remove a `src` e força um `.load()`, parando efectivamente qualquer buffer de rede ou descodificação em andamento, segundo as especificações do W3C para descartar elementos de média.

## Conclusão da Auditoria
O design actual é **robusto e seguro**. O mecanismo de guard baseado em `generation` (no Adapter) + cleanup do React (no Slide) + limpeza estrita no `disposeMediaElement` garante absolutamente que `activeMediaCount <= 1`.
Não existe a possibilidade de uma Race Condition onde o `<video>` antigo toca ao mesmo tempo que o novo, porque o antigo é despojado da sua `src` imediatamente na tick em que a geração muda.
