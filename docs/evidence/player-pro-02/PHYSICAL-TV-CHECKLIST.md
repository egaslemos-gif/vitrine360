# PLAYER-PRO-02 — Checklist de validação física (NÃO efectuada)

**Nenhuma validação em Smart TV real (Hisense SRAF ou outra) foi feita.** Os testes em Chromium não substituem esta checklist. O runtime legacy `public/tv.js` não foi alterado.

Registar para cada TV: modelo, firmware, browser/versão (user agent), codec/resolução do vídeo, se o ecrã inteiro/quiosque está activo.

## A. Player React (`/player`)
1. Reiniciar a TV, abrir `/player` **sem premir nada**. Anotar: o vídeo arranca? Com ou sem som? Aparece "Som bloqueado… toque para ativar"?
2. Premir **OK/Enter** uma vez: o som é restaurado sem o vídeo reiniciar/pausar? O botão passa de "Ativar som" a "Mute"?
3. Se o vídeo não arrancar de todo: aparece "O navegador bloqueou a reprodução…"? OK/Play arranca-o sem saltar de item?
4. Parar (Stop/keyCode 413) e esperar 5 s: o vídeo continua parado? Play (415) retoma?
5. Pause (19) → seek (setas/Home) → esperar: continua em pausa e sem avanço?
6. Home duas vezes seguidas (depois de o vídeo avançar): volta ao início nas duas?
7. Mute/Unmute e volume: o som muda de facto? Volume 0 → Unmute volta a ter som?
8. ≥ 3 ciclos da playlist (vídeo, imagem, GIF, áudio): passa do último para o primeiro? Em modo `ITEM`/`NONE` comporta-se como indicado? O botão de repetição é legível a 1080p e em janela estreita?
9. EXPERIENCE (se existir): Play/Pause e Stop aparecem desactivados; o conteúdo continua a avançar na playlist.
10. Desligar a rede 10 s durante um vídeo: aparece "A carregar…" e, se o vídeo falhar, "Falha de rede…"? Recupera ao reconectar?

## B. Runtime legacy (`/tv.html`) — regressão apenas
Repetir os pontos 1, 8 e 10 do `PLAYER-RELIABILITY-01`; ler `localStorage["v360-tv-last-media-error"]`.

## C. Dados a enviar
Resultado por ponto (OK / falhou + o que se viu), fotografia ou vídeo curto do ecrã, user agent, e (se possível) a consola do browser. Só depois destes dados é legítimo classificar a paridade computador × SRAF.
