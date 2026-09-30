# VIDEO LIFECYCLE (HISENSE)

**Chromium Desktop**:
Usa blob URLs a partir de IndexedDB sem grandes problemas.
Garante transição rápida sem network I/O.

**Hisense/SRAF**:
- A feature `PLAYBACK-HISENSE-VIDEO-01` (`ensure-media-playback.ts` e `playback-renderer-adapter.tsx`) força a utilização da URL direta com token (byte-range request via API) em caso de VIDEO, contornando a falha nativa em blob streaming do browser SRAF.
- No Legacy `tv.js`, um bug de renderização no `display:none` foi documentado no código, contornando com `left:-10000px`. O legacy usa `left:-10000px` para carregar o vídeo.

**CONCLUSÃO**: O comportamento da Hisense face a `blob:` vídeos já foi mitigado no React player via streaming direto HTTP. Se existirem saltos no player React, é provável que a Hisense esteja a enviar um `onError` por falta de Codec ou o load metadata demorar mais tempo do que a timeout estrita do player que considera `MEDIA_PLAY_ERROR` e avança/pára a reprodução.
