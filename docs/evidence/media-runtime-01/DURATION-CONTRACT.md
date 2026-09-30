# MEDIA-RUNTIME-01: DURATION CONTRACT

## O Problema Original
Diferentes componentes (Manifest, Editor, Preview, PlaybackController) tinham lógicas independentes para deduzir se um conteúdo deveria ser interpretado como tendo duração natural (aguardando os eventos do elemento HTMLMediaElement) ou duração fixa (utilizando o PresentationTimer). Isso causava bugs nas transições, especialmente quando a duração configurada era 0.

## O Contrato (EffectiveDuration)
Todo o cálculo de duração passa a obedecer ao seguinte contrato:

```typescript
export type EffectiveDuration =
  | {
      mode: "NATURAL";
      durationMs: null;
    }
  | {
      mode: "FIXED";
      durationMs: number;
    };
```

### Regras de Resolução (`resolveEffectiveDuration`)

O resolvedor avalia `mediaType`, `contentDurationMs` e `playlistOverrideMs` da seguinte forma:

1. A duração inicial (`effectiveMs`) é avaliada como `playlistOverrideMs` (se não for `null`) ou `contentDurationMs`.
2. **VIDEO / AUDIO**:
   - Se `effectiveMs === 0` → Retorna `{ mode: "NATURAL", durationMs: null }`. O Player irá depender inteiramente dos eventos `ended` nativos.
   - Se `effectiveMs > 0` → Retorna `{ mode: "FIXED", durationMs: effectiveMs }`. O Player utilizará o `PresentationTimer`.
3. **IMAGE / TEXT / NOTICE / EVENT / CLOCK / QR_CODE / GIF**:
   - Se `effectiveMs === 0` → Retorna `{ mode: "FIXED", durationMs: 8000 }` (a duração default definida pelo domínio).
   - Se `effectiveMs > 0` → Retorna `{ mode: "FIXED", durationMs: effectiveMs }`. O Player utilizará o `PresentationTimer`.

## Uso Universal
Este único resolvedor agora é a fonte de verdade para:
- **Manifest Builder:** Ao enviar a playlist para os ecrãs.
- **Playlist Editor:** Para mostrar "Natural" versus uma duração fixa.
- **Playlist Preview:** Para saber se deve aguardar o fim nativo do vídeo ou usar timer.
- **PlaybackController / Renderer Adapter:** Para classificar a temporização e instanciar (ou não) o PresentationTimer.
