# GENERATION / STALE EVENT AUDIT

Eventos do media adapter possuem um token de `generation` (ex: `onMediaEvent({ type: "MEDIA_ENDED", generation })`).
No `PlaybackController`, todas as verificações de eventos media (ex. `onMediaEnded(generation: number)`) iniciam com:
```ts
if (generation !== this.state.generation) return;
```
Isso anula eventos atrasados (stale events).

**Cenário VIDEO A -> ERROR -> VIDEO B**: 
Se o VIDEO A demorar a emitir o evento ERROR após a playlist já ter avançado para o VIDEO B (via user action NEXT), a generation do Controller já é de B. O ERROR de A é comparado (genA !== genB) e é ignorado.

**CONCLUSÃO**: Stale events de media anterior NÃO podem alterar o estado do item atual B, pois a `generation` já foi incrementada aquando do avanço para o item B. A integridade da `generation` é infalível.
