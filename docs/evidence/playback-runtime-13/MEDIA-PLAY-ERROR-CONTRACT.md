# MEDIA_PLAY_ERROR CONTRACT

## Análise de Implementação Atual

A diretiva atual mapeia falhas recuperáveis (que incluem `MEDIA_PLAY_ERROR` vindo do autoplay) diretamente para `NEXT` de forma incondicional no `PlaybackController`.

Caminho atual do erro de Autoplay (ex: NotAllowedError):
1. `ensureMediaPlayback()` tenta `play()` mutado (ou audível) e falha com rejection.
2. `ensureMediaPlayback` chama `onUnrecoverable("muted_autoplay_denied")`.
3. `PlaybackRendererAdapter` emite o dispatch:
   ```ts
   onMediaEvent({
     type: "MEDIA_ERROR",
     code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
     message: "Playback could not start",
     recoverable: true,
     generation,
   });
   ```
4. `PlaybackController.onMediaError` executa o seguinte bloco:
   ```ts
   onMediaError(code, message, recoverable, generation) {
     if (generation !== this.state.generation) return;
     if (recoverable) {
       this.next(); // <-- AVANÇO INCONDICIONAL
       return;
     }
     // ...
   }
   ```

### Matriz de Erros (Estado Atual / Incorreto)

| Causa de Erro | Classificação | Estado Esperado (Contrato) | Ação Atual Implementada | Desvio |
| --- | --- | --- | --- | --- |
| Autoplay Rejection (`NotAllowedError`) | Recoverable | PAUSED | NEXT | ❌ FATAL |
| Recoverable Play Rejection | Recoverable | PAUSED | NEXT | ❌ FATAL |
| Decode Failure | Recoverable | ERROR / NEXT | NEXT | ⚠️ Divergência na transição de UI |
| Unsupported Media | Recoverable | ERROR / NEXT | NEXT | ⚠️ Divergência na transição de UI |
| Network/Load Failure | Recoverable | ERROR / NEXT | NEXT | ⚠️ Divergência na transição de UI |
| Terminal Media Failure | Terminal (`recoverable=false`) | ERROR (permanente) | ERROR | ✅ Passa |

## Conclusão da Auditoria

O sistema **falha** no requisito PLAYBACK-CONTRACT-01.
Ao transformar "recoverable" num salto `NEXT` cego para resolver o problema de UI congelada, introduziu-se um bug fatal:
- Múltiplas falhas de autoplay na inicialização causarão um ciclo veloz e infinito de `NEXT`, ignorando itens que requerem interação para desmutar.
- A TV pode não recuperar e entrar em *boot loop* lógico da playlist.

**Recomendação de Fix:** Reverter o `MEDIA_PLAY_ERROR` para o estado `PAUSED` sem avançar, e separar os erros de playback/autoplay (`MEDIA_PLAY_ERROR`) dos erros de demux/decoder/network (`MEDIA_LOAD_ERROR`, `MEDIA_DECODE_ERROR`).
