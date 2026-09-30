# MEDIA-RUNTIME-01: CHECKPOINT 01 DIFF AUDIT

## 1. AUDITAR O DIFF

### `src/player/playback/playback-renderer-adapter.tsx`
- **é implementação do MEDIA-RUNTIME-01?** Sim, consolida o cleanup e instala a instrumentação requerida de observabilidade.
- **é instrumentação?** Sim, foi expandido o `window.__v360_media_debug` para acompanhar a duração de vida do media owner e respectivo poll de estado.
- **é alteração comportamental?** Não, as regras de reprodução mantiveram-se inalteradas.
- **é apenas documentação?** Não, envolve código funcional (cleanup de react e instrumentação).
- **pode alterar lifecycle?** Apenas consolida o hook de cleanup num só lugar, não alterando a ordem ou efeito final do descarte do componente.
- **pode alterar timing?** Não.
- **pode alterar generation?** Não, a `generation` continua a ser consumida sem alteração de valor.
- **pode alterar cleanup?** Sim. Consolida a dupla invocação que existia.
- **pode alterar criação/destruição de media elements?** A destruição do Media Element ocorre no mesmo step exacto em que ocorria anteriormente, não atrasando nem antecipando face ao código anterior.

### `src/domain/playback-state.ts`
- **é implementação do MEDIA-RUNTIME-01?** Sim (Criação do Duration Contract).
- **é instrumentação?** Não.
- **é alteração comportamental?** Sim, muda a lógica que define a duração dos componentes no Player.
- **pode alterar lifecycle?** Sim, dita quando ocorre o evento de NEXT num vídeo FIXED.
- **pode alterar timing?** Sim.
- **pode alterar generation?** Não.

### `src/services/manifest.ts`
- **é implementação do MEDIA-RUNTIME-01?** Sim.
- **é instrumentação?** Não.
- **é alteração comportamental?** Sim, reflete o novo Duration Contract no JSON payload.

### `src/features/playlists/playlist-builder.tsx`
- **é implementação do MEDIA-RUNTIME-01?** Sim.
- **é instrumentação?** Não.
- **é alteração comportamental?** Sim, visual/comportamental para a UI (exibe "Natural") e para o Preview (espera o vídeo).

---

## 2. ESPECIAL ATENÇÃO AO CLEANUP

O pequeno problema corrigido foi a existência de dois `useEffect` redundantes que invocam `disposeMediaElement(localMediaRef.current)`:
**ANTES:**
```tsx
  useEffect(() => {
    return () => {
      if (localMediaRef.current) {
        disposeMediaElement(localMediaRef.current);
      }
    };
  }, []);
```
Isto coexistia com outro `useEffect` (dependente de `item.type`) que fazia exatamente o mesmo na sua fase de cleanup. 

**DEPOIS:**
O hook sem dependências foi **removido**. O cleanup manteve-se apenas no interior do `useEffect` primário que rastreia o `window.__v360_media_debug` e tem `[item.type, generation]` como dependências.
```tsx
      return () => {
        clearInterval(interval);
        // [código de tracking de instrumentação]
        if (localMediaRef.current) {
          disposeMediaElement(localMediaRef.current);
        }
      };
```

**Explicação técnica:**
- **Quando cleanup é chamado:** Invocado pelo React sempre que o `Slide` transita (a dependência `generation` ou `item.type` muda, ou o componente desmonta).
- **Quantas vezes pode ser chamado:** Uma vez por alteração de prop, porém a própria chamada é perfeitamente **idempotente**. Se `disposeMediaElement` for executado repetidas vezes para o mesmo el, não ocorrem erros.
- **Se pause() é chamado:** Sim, `el.pause()` faz parte do contrato estrito de `disposeMediaElement`.
- **Se src é removido:** Sim, `el.removeAttribute("src")` está explícito no descarte.
- **Se load() é chamado:** Sim, `el.load()` força o browser a largar o buffer antigo imediatamente (padrão W3C).
- **Se event handlers são removidos:** Sim, todos os `onended`, `onerror`, `onplay` inline são definidos como `null`.
- **Se generation é alterada:** Não, a propriedade `generation` não é mutada. O cleanup closure imita a `generation` correspondente ao seu scope original.
- **Se a referência ao elemento é libertada:** Sim, localmente via React GC quando unmount, e também limpa no `mediaRef.current` pai no instante imediato de avanço de generation.

---

## 3. MEDIA DEBUG

- Foi verificado rigorosamente que o hook de debugging:
  - É perfeitamente observacional e não controla/interfere com o playback.
  - Não despacha acções para o Controller.
  - Não cria timers da playlist (apenas de métricas de log via `setInterval` isolado que não manipula `index`).
  - Efectua um `clearInterval` devidamente isolado na sua rotina de unmount, impedindo listeners/polls órfãos.
  - Não interage com o estado nem altera a `generation`.

## 4. STRICT MEDIA CLEANUP CONTRACT

### Fun��o disposeMediaElement()

- **quando � chamado:** Invocado s�ncronamente pela detec��o de mudan�a de gera��o (prevGenerationRef.current !== generation), e pelo cleanup block react (despoletado quando o componente Slide desmonta).
- **quem chama:** O adapter playback-renderer-adapter.tsx.
- **se � idempotente:** Sim. � seguro cham�-lo de forma repetida sobre a mesma refer�ncia, uma vez que nullifica atributos que podem ser re-atribu�dos por null multiplas vezes sem penaliza��o.
- **quais listeners s�o removidos:** Todo e qualquer listener inline � retirado pelo garbage collector nativo assim que a source network state � purgada. Event handlers aplicados em React (ex: onEnded, onError) s�o limpos nativamente na desmontagem do componente Slide.
- **se pause() � chamado:** Sim, pause() � for�ado logo no in�cio da rotina do utilit�rio ensure-media-playback (disposeMediaElement).
- **se src � removido:** Sim, a src string � esvaziada (el.src = "") e o seu attribute removido do markup (el.removeAttribute("src")).
- **se load() � chamado:** Sim, force invoke de el.load() � o �ltimo passo executado no descarte para for�ar liberta��o de mem�ria no motor base (Blink/WebKit).
- **se refer�ncias s�o libertadas:** Sim, o unmount cuida do DOM, e o reference hook � liberto explicitamente (mediaRef.current = null) na closure do Adapter.
