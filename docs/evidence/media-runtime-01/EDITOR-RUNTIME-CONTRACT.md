# MEDIA-RUNTIME-01: EDITOR-RUNTIME CONTRACT

## Objectivo (Fases 1, 11 e 12)
O comportamento de cálculo de duração não podia ser ambíguo. O Editor, a Preview, o Manifest Builder e o Player precisavam de obedecer a uma lógica absoluta. 

## Implementação
Criámos um modelo `EffectiveDuration` (em `src/domain/playback-state.ts`), partilhado por toda a aplicação:

```typescript
export function resolveEffectiveDuration({
  mediaType,
  contentDurationMs,
  playlistOverrideMs,
}: {
  mediaType: string;
  contentDurationMs: number;
  playlistOverrideMs: number | null;
}): EffectiveDuration
```

## Editor & Preview (Playlist Builder)
O ficheiro `playlist-builder.tsx` foi actualizado para invocar `resolveEffectiveDuration`. 

**Representação Visual (UI):**
- Sempre que `mode === "NATURAL"`, a duração de cada item é listada inequivocamente como **Natural**.
- Para a **duração total** da playlist, caso a playlist possua qualquer elemento natural, o total passou a exibir a soma fixa adicionando ` + Natural` (Ex: `05:30 + Natural`). Isto não esconde ao utilizador final que a duração exacta só será deduzida runtime pelos reprodutores media.
- Na **Preview** da Playlist (`playlist-timed-preview.tsx`), os itens são mapeados recorrendo à mesma função, garantindo que `durationMs = 0` sinaliza à Preview (via `onEnded` do vídeo) que tem que esperar pelo fim nativo do ficheiro em vez de simular uma barra de progresso irrealista de 10 segundos (ou 8, conforme os fallbacks antigos).

## Vantagens
Este contrato extinguiu completamente as dessincronizações antigas onde o ecrã A exibia fallbacks de 8000ms enquanto o dispositivo de TV B interpretava 0ms como duração infinita.
