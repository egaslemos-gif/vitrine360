# IMPLEMENTATION

A correção foi implementada para garantir que o comportamento de playback perante falhas seja previsível e obedeça aos contratos rígidos estabelecidos no FCT2026.

## 1. MEDIA_PLAY_ERROR (Autoplay Rejection)
A regressão inserida anteriormente tentou resolver o problema de falhas no start avançando de imediato a playlist (`NEXT`), o que quebrou a idempotência perante browsers com `Autoplay Policy` restrita (ex. WebOS, SRAF). 
O código em `src/player/playback/playback-controller.ts` foi revertido para colocar a interface e o estado em `PAUSED` explicitamente:
```typescript
    if (code === "MEDIA_PLAY_ERROR") {
      this.commit({ status: "PAUSED", error: null });
      return;
    }
```

## 2. Retry Semântico Sem Reconstrução
O Adapter (`playback-renderer-adapter.tsx`) já possuía a infraestrutura correta para lidar com `PAUSED → PLAYING` de forma isolada, não disparando nova key de render. Com o retorno à semântica `PAUSED`, quando ocorre um `MEDIA_PLAY_ERROR` e é despachado o evento, o player entra em modo manual.
Caso uma ação do ecrã dispare `PLAY` sobre o mesmo asset, a verificação `if (el.paused)` executará um bypass ao hook, instanciando o `ensureMediaPlayback(el)` novamente **no mesmo elemento instanciado em background**, contornando a construção pesada do decodificador na TV.

## 3. Terminal Errors
Falhas irrecuperáveis como erro de decoding (`MEDIA_DECODE_ERROR`) ou media corrompida mantêm a flag `recoverable = false` via callback nativo de erro e mantêm o estado de `ERROR` de acordo com a política actual do `PlaybackController`.

## 4. Single Source of Truth
Nenhuma lógica DOM imperativa foi movida para o `PlaybackController`. Este continua estrito, recebendo os dispatches do `RendererAdapter` com a metadata do error code correspondente.
O DOM e `HTMLMediaElement` continuam exclusivos do Renderer.
