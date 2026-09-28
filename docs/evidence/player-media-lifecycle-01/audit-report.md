# PLAYER-MEDIA-LIFECYCLE-01: Audit Report

## 1. Hipótese
A hipótese inicial era de que "mais de um HTMLMediaElement possa estar activo simultaneamente, ou que existam dois caminhos de lifecycle/control actuando sobre o mesmo item", o que justificaria o comportamento observado em Chromium (áudio duplicado) e Smart TVs (ecrã azul e dessincronização).

## 2. Investigação e Evidências

Foi auditada a estrutura de rendering em `src/player/playback/playback-renderer-adapter.tsx`, prestando especial atenção ao ciclo de vida do componente `<Slide>` e à gestão dos elementos `<video>`.

Foi identificada a seguinte sequência de eventos no lifecycle do componente React:

1. **Mudança de Geração**: O controller emite um `NEXT`, o que incrementa a `generation`.
2. **Unmount do Slide**: Como o componente `<Slide>` usa a propriedade `key={rendererKey}` (que contém a `generation`), a mudança de geração força o React a destruir completamente o componente `<Slide>` antigo e a montar um novo.
3. **React Ref Cleanup**: Antes de desmontar o componente e executar os efeitos de cleanup, o React invoca a callback ref do elemento `<video>` passando `null` (em React 17+).
   ```tsx
   ref={(el) => {
     localMediaRef.current = el; // <-- Torna-se null
     mediaRef.current = el;
     // ...
   }}
   ```
4. **useEffect Cleanup**: O `useEffect` responsável pelo cleanup do media tag é executado *após* o unmount do elemento e *após* a callback ref ter sido chamada com `null`:
   ```tsx
   useEffect(() => {
     return () => {
       const el = localMediaRef.current; // <-- el é null!
       if (el) {
         try {
           el.pause(); // <-- NUNCA é executado
           el.removeAttribute("src");
           el.load();
         } catch {
           // ignore
         }
       }
     };
   }, []);
   ```

## 3. Consequências do Stale Ref

Dado que o `el.pause()` nunca chega a ser invocado no cleanup:
- O elemento `<video>` é removido do DOM pelo React.
- **No entanto**, em Chromium (e em Smart TVs baseadas em Chromium/Webkit), um `HTMLMediaElement` removido do DOM sem ter sido previamente `paused` **continua a reproduzir áudio em background** até que seja alvo do Garbage Collector.
- O atraso do Garbage Collector significa que a geração `N` continua a tocar simultaneamente com a geração `N+1`, justificando de imediato o "áudio duplicado" no Chromium.
- **Smart TVs (Hisense / WebOS)**: Estes dispositivos impõem limites rígidos de hardware ao decoding simultâneo. Quando a geração `N` mantém a pipeline de descodificação de hardware ocupada (visto que o GC ainda não a limpou), o pedido da geração `N+1` para reproduzir o novo vídeo falha ao alocar recursos, resultando no ecrã azul, falhas de descodificação, e consequente dessincronização da lógica (pois o player assume o novo status, mas o ecrã não consegue renderizar).

## 4. Classificação

Este é claramente um **Erro de Cleanup/Resource Leak no React Lifecycle (Stale Ref Closure)**. Não existem "dois players" concorrentes ao nível de arquitectura (o PlaybackController orquestra corretamente o avanço), mas o DOM leak físico de um elemento zombie causa os artefactos observados.

## 5. Conclusão

**A hipótese está parcialmente PROVADA**: Múltiplos `HTMLMediaElement` acabam de facto por ficar ativos e a reproduzir simultaneamente, consumindo recursos no background devido à falha do cleanup react. A causa-raiz é uma anomalia de unmount clássica em React (callback refs invocadas com null antes dos effects).
