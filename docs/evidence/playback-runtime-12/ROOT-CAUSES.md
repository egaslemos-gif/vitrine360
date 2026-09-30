# ROOT CAUSES IDENTIFIED

Nenhuma evidência de "leak", múltiplos "media owners", ou "conflito de runtimes" foi encontrada na auditoria estática do código fonte. 
A arquitetura do `PlaybackRendererAdapter` e as verificações rigorosas de `generation` garantem que o controller descarta eventos obsoletos, logo, não há duplicação de owner ou state corruption. 
O unmount das views (`<Slide>`) retira as tags media do DOM e revoga a memória e liberta a thread (em React).

**As lacunas descobertas (que poderão causar sintomas anómalos):**
1. **PLAYLIST-IDENTITY**: A metadata com o `playlistName` não é encapsulada na serialização do `DeviceManifest` e não flui no Sync, tornando-a ausente no HUD (`DisplayIdentityHud`).
2. **BROWSER LOOP (suspeita de erro Hisense)**: Se o vídeo falhar num erro inesperado e o evento `onError` for disparado pela Smart TV (por ex: code error nativo sem reportar status, ou formato não reconhecido a meio da stream), a fallback recovery é emitir `MEDIA_PLAY_ERROR`, e o controller recua a `PAUSED`. O `PAUSED` impede a progressão do auto-loop da playlist até intervenção manual.
3. **AUDIO UNMOUNT HISENSE NATIVE LEAK**: Se a smart TV possuir um bug do webview onde remover o audio tag do DOM sem limpar todos os listeners / parar efetivamente a fonte continua a dar play na thread nativa, o react não consegue evitar (pois o unmount do react faz `pause()`, `src=""`, `load()`). Não foi verificado no código, o código faz o bypass limpo padrão W3C.
