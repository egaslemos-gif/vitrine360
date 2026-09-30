# MEDIA-RUNTIME-01: IMPLEMENTATION REPORT

## 1. Duração Effectiva (EffectiveDuration)
- **Modificações Feitas:**
  - `src/domain/playback-state.ts`: Criado e exportado tipo `EffectiveDuration` e a função de resolução unificada `resolveEffectiveDuration`. 
  - Subscrito o comportamento antigo de `resolveItemDurationMs` para utilizar internamente o novo contrato, garantindo suporte legado de domínios.

## 2. Unificação no Playlist Builder (Editor e Preview)
- **Modificações Feitas:**
  - `src/features/playlists/playlist-builder.tsx`:
    - Adicionado suporte `+ Natural` no cálculo de duração total para clarificar utilizadores aquando de estimativas.
    - Alterado cálculo de display do item individual para confiar no output da nova engine.
    - O subcomponente `PlaylistTimedPreview` passou a receber mapeamentos baseados em `EffectiveDuration.durationMs`.

## 3. Unificação no Manifest
- **Modificações Feitas:**
  - `src/services/manifest.ts`: Substituído cálculo in-place de fallback `item.durationOverrideMs ?? content.durationMs` pela função de domínio `resolveEffectiveDuration`. Garante coerência entre a representação do JSON exportado (backend/cache) e as expectativas do cliente de Playback.

## 4. Playback Renderer & Controller 
- **Auditoria & Fixação (Fase 0-20):**
  - **Autoridade do Índice:** Mantém a arquitectura actual (Fase 2) — o DOM apenas imite estados e eventos genéricos (READY, ENDED, ERROR) e o Controller decide o momento da transição e acção.
  - **MEDIA OWNER:** Componentes estão protegidos de race-conditions via token de `generation` estrito em cada callback (Fase 7). A limpeza baseia-se num synchronously called `disposeMediaElement`, forçando paragem (`pause`), remoção (`src`) e recarregamento vazio (`load()`).
  - **Audio/Video (Fases 8-9):** O Renderer distingue de forma correcta e comprovada o loop Native (0s) e Fixed (>0s) sem emitir eventos repetidos. Manteve-se o HTMLVideoElement para processamento de faixas MP3/WAV, pois resolve o bloqueio global de Chromium/VIDAA a Autoplays de áudio sem interacção prévia.

Todos os itens especificados no manifesto de objectivos iniciais (AUDIO, VIDEO, duração natural e override, playlist editor, preview, media lifecycle e sobreposição) operam agora em sincronia estrita ao longo de toda a stack através do único `EffectiveDuration` contrato de domínio.
