# ITEM IDENTITY

## Configuração e Fluxo
Durante a reprodução:
Item 1 → Item 2 → Item 3

O HUD extrai o `itemTitle` dinamicamente das propriedades. O ficheiro `src/features/player/player-app.tsx` envia o titulo do item para o componente visual `PlaybackChrome`:
```tsx
const current = items[playbackState.currentItemIndex];
<PlaybackChrome itemTitle={current?.title ?? null} ... >
```

## Resposta ao PlaybackState
Visto que `currentItemIndex` avança ativamente em `playbackState` e engatilha um novo render cycle no UI, o título apresentado no Identity HUD acompanha cada nova media exibida pela `DisplayEngine`.

## Prevenção de Falsos Positivos
O HUD não está fixo no `manifest.items[0]`. O apontador avança de forma síncrona com o estado do motor (Engine).

## Conclusão
Item Correctness - **PASS**.
