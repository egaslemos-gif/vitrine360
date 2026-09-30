# REPEAT POLICY

**React Player**:
- Suporta `RepeatMode.NONE`, `RepeatMode.ITEM`, `RepeatMode.PLAYLIST`.
- Default: Inicializado via `createInitialPlaybackState(0)`, por defeito `PLAYLIST`.
- Na navegação (`next()`), se no último index e `PLAYLIST`, volta a 0. Se `NONE`, vai para estado `ENDED`. Se `ITEM`, apenas recomeça a positionMs.

**Legacy Player**:
- Infinito por predefinição: `playState.index = (playState.index + 1) % playState.items.length;`
- Não suporta Stop on End.

**CONCLUSÃO**: Comportamento é bem documentado. O default em device operations (React) é `PLAYLIST` (looping contínuo). A Landing Demo pode ter comportamentos distintos se injetar `NONE`, mas o `PlaybackController` operacional está configurado corretamente.
