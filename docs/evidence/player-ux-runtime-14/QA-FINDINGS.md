# PLAYER-UX-RUNTIME-14B — QA FINDINGS & FIX PLAN

## 6 Problemas Identificados

### P1. Vídeo roda sem áudio (precisa interagir com os controls para ter som)
**Causa raiz**: O `<video>` é renderizado com `muted={true}` (linha 542 do playback-renderer-adapter.tsx). O `ensureMediaPlayback` tenta primeiro `play()` com áudio, e se rejeitado pelo browser (autoplay policy), faz fallback para `startMuted()` → depois tenta `applyDesiredAudio()` + `recoverIfPausedAfterUnmute()`. Contudo, o atributo HTML `muted={true}` está hardcoded, o que força o browser a iniciar muted — e o `recoverIfPausedAfterUnmute` pode falhar silenciosamente em mobile Chrome (que é mais restritivo que desktop).
**Fix**: O `muted` attribute no JSX deve refletir `state.muted` em vez de ser hardcoded `true`. O `ensureMediaPlayback` já é responsável por gerir o fallback muted→unmute.

### P2. Controls/títulos não são responsivos em ecrãs pequenos
**Causa raiz**: O `PlaybackControls` tem largura fixa `min(920px, calc(100% - 24px))` e o conteúdo interno não se reorganiza para mobile.
**Fix**: Adaptar o layout do PlaybackControls para esconder elementos secundários (Stop, Restart, volume slider) em compact mode e reorganizar o layout.

### P3. Botão "Entrar em ecrã inteiro" (shell) conflita com controls do player
**Causa raiz**: Existem DOIS botões fullscreen: um na `FullscreenControlChrome` (shell.tsx, bottom, zIndex:40) e outro no `PlaybackControls` (⛶). Ambos cobrem a mesma zona inferior do ecrã.
**Fix**: Remover completamente o `FullscreenControlChrome` do shell e manter apenas o botão ⛶ dentro do PlaybackControls.

### P4/P5. Vídeo/Áudio repetem no background quando outros itens estão a passar
**Causa raiz CRÍTICA**: O `loop` prop no `<video>` é `loop={item.durationMs > 0 && (type === "VIDEO" || type === "AUDIO")}`. Quando `durationMs > 0`, o vídeo/áudio fica em loop HTML nativo. Quando o PlaybackController avança para o próximo item, a `generation` muda, o `rendererKey` muda, e o React deveria desmontar a Slide anterior. MAS: o `disposeMediaElement` é chamado somente na cleanup do `useEffect([item.type])` que está preso ao tipo do item, não ao key. E existe um segundo cleanup em `useEffect([])`. Se o React não desmonta correctamente (e.g., StrictMode ou race condition), o elemento media pode continuar a reproduzir.
**Fix**: Forçar dispose explícito do `mediaRef.current` no `PlaybackRendererAdapter` quando `generation` muda — parar o media ANTES de montar o novo Slide. Adicionalmente, garantir que `disposeMediaElement` é chamado de forma determinística no ref callback quando o ref muda.

### P6a. MIME `.m4a` rejeitado para AUDIO
**Causa raiz**: O browser Android pode reportar `.m4a` como `video/mp4` (pois `.m4a` é um container MP4). O `sniffMime` detecta `ftyp` e verifica o brand — para `.m4a` com brand `M4A ` retorna `audio/mp4` (correcto). Porém, se o brand for `isom` ou `mp42` (que muitos encoders usam mesmo para audio-only M4A), o sniffer retorna `video/mp4`, e o `assertMediaCompatibleWithType` rejeita porque `video/mp4` não começa com `audio/`.
**Fix**: No passo de normalização em `uploadOrHealAsset` e `prepareMediaAsset`, já existe lógica para converter `video/mp4 → audio/mp4` quando o client declara `audio/*`. Mas o `assertMediaCompatibleWithType` é chamado DEPOIS da criação do asset, usando o `asset.mimeType` que veio do sniffer como `video/mp4`. A fix correcta é: no `sniffMime`, adicionar detecção de brands adicionais que são audio-only M4A (como `isom` com extensão `.m4a`). Alternativamente, adaptar a lógica no `assertMediaCompatibleWithType` para considerar que o client quis AUDIO quando o brand indica MP4 container.

### P6b. ENTITLEMENT_DENIED para non-SUPER_ADMIN
**Causa raiz**: O `reserveStorageForUpload` é chamado no media upload. Quando `isEntitlementsEnabled() === true`, o sistema resolve entitlements para o tenant. Se o tenant não tem um plano com `storage.maxBytes` definido, lança `EntitlementDeniedError`. Isso bloqueia qualquer tenant sem plano configurado.
**Fix**: Verificar se o tenant em questão tem entitlements configurados. Se `ENTITLEMENTS_ENABLED=false` ou se o plano do tenant inclui storage suficiente, o upload deve ser permitido. O erro "ENTITLEMENT_DENIED" genérico precisa de uma mensagem mais descritiva no UI.
