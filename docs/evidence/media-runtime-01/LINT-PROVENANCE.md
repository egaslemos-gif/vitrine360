# MEDIA-RUNTIME-01: LINT PROVENANCE

## 1. PROVENIÊNCIA DOS ERROS `react-hooks/refs`

A working tree foi testada nos seus dois estados (`BASE` isolado via `git stash` e `CURRENT` após restauro via `git stash pop`).

- **BASE**: 6 erros identificados no ficheiro `src/player/playback/playback-renderer-adapter.tsx`.
- **CURRENT**: Os mesmíssimos 6 erros no mesmíssimo ficheiro.

### Detalhe do Erro:
**Ficheiro:** `src/player/playback/playback-renderer-adapter.tsx`
**Linhas:** 123, 124, 125, 126 e 127.
**Mensagem (Linter):** `Error: Cannot access refs during render` / `Cannot update ref during render`

- **Existia no BASE?** Sim. Foi provado através da extração directa de `npm run lint` sobre o repouso original sem os diffs correntes.
- **Foi introduzido pelo MEDIA-RUNTIME-01?** Não.
- **Foi apenas deslocado por edição?** Não, as posições mantiveram-se inalteradas em relação à implementação original (linhas 123-128 permaneceram intactas, a minha edição ocorreu na linha 353+).
- **Qual commit introduziu?** O erro provém da concepção original do ficheiro antes da iniciativa `MEDIA-RUNTIME-01`, onde se programou uma read/write sobre `prevGenerationRef.current` directamente no corpo do componente (que é um anti-padrão no StrictMode do React 18).

## 2. PROVENIÊNCIA DO WARNING EM `playlist-builder.tsx`

- Um aviso em `src/features/playlists/playlist-builder.tsx` (linha 110: `'isFallback' is assigned a value but never used`) **tinha sido introduzido** pelo sprint inicial (durante o refactoring do duration contract).
- **Resolução**: Este aviso foi resolvido definitivamente na working tree actual através da remoção total da variável não utilizada. O Linter está agora completamente isento de dívida introduzida pelo `MEDIA-RUNTIME-01`.
