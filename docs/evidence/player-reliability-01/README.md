# PLAYER-RELIABILITY-01 — Smart TV e browser: vídeo, playlist e design do leitor

Pedido: vídeo não corre nas Smart TVs (só áudio, e imagens de forma inconsistente); playlist deve arrancar com repetição e ecrã inteiro; leitor no browser em vidro translúcido; varredura de inconsistências; não confundir duração natural com a definida na playlist.

## 1. Causas encontradas

| # | Causa | Onde | Efeito |
|---|---|---|---|
| 1 | **O ecrã de emparelhamento era redesenhado por cima da reprodução** a cada segundo. O `pairingClockTimer` nunca era cancelado quando a reprodução começava | `public/tv.js` | Na sessão em que a TV é emparelhada, `<video>` e `<img>` eram destruídos de segundo a segundo até o código expirar (até 15 min). Vídeo nunca arranca, imagens piscam. Só depois de recarregar ficava normal |
| 2 | **O proxy de media ignorava `Range`**. Declarava `Accept-Ranges: bytes` mas devolvia sempre `200` com o ficheiro inteiro em memória | `/api/device/media/[assetId]` | Browsers de TV (Sraf, Tizen, webOS, VIDAA) exigem `206` para iniciar MP4 (procuram o `moov`). Respostas de função na Vercel têm limite de 4,5 MB, por isso vídeos maiores falhavam. Áudio e imagens (pequenos, sequenciais) passavam |
| 3 | Vídeo que não arrancava em 8 s era **saltado em silêncio** e o erro só era tratado depois de revelado | `tv.js` `showVideo` | Em redes lentas o vídeo nunca chegava a ser visto |
| 4 | Imagem em cache local (`blob:`) era **descarregada de novo a cada ciclo** (timeout 8 s) e o tempo do slide contava durante o carregamento | `tv.js` `renderImageSlide` | Imagens inconsistentes: às vezes nem chegavam a aparecer |
| 5 | Um item avariado ou parado deixava o player React **parado para sempre** (ERROR, LOADING sem limite) | `playback-controller` / adaptador | Um ficheiro mau congelava um ecrã sem supervisão |
| 6 | O `ref` inline do `<video>` voltava a correr `ensureMediaPlayback` a cada render (cada `timeupdate`) | adaptador | Áudio a alternar entre mudo e com som, `play()` rejeitado |
| 7 | Vídeo de **janela fixa** mais longo que o ficheiro congelava no último frame; duas fontes a escrever a posição | adaptador | Barra de progresso saltava |

## 2. Correções

**Servidor**: `src/lib/http-range.ts` (parser testado), `route.ts` do proxy com `206`/`416`/`Content-Range`, blocos de 4 MB (abaixo do limite de 4,5 MB), streaming por blocos sem `Range`, `getObjectRange`/`headObject` no storage local (o R2 já tinha).

**Smart TV (`tv.js` v0.1.28, ES5 puro, cache-bust `v058`)**: pairing clock cancelado; várias fontes de vídeo por ordem (URL do manifesto → proxy com token → URL original); watchdog adaptativo (15 s sem sinal de vida, 60 s no máximo por fonte); falha visível ("Não foi possível reproduzir este conteúdo") em vez de salto silencioso e sem ciclo quente; último erro em `localStorage` (`v360-tv-last-media-error`); imagens a partir da cache e tempo contado desde o primeiro desenho; ecrã inteiro por defeito (tenta logo; senão no primeiro gesto, uma só vez).

**Player React**: `usePlaybackRecovery` (ERROR → 1 nova tentativa após 2,5 s → salta após 4,5 s; LOADING > 30 s → `MEDIA_TIMEOUT`); `ref` estável; media faz loop dentro da janela fixa e o cronómetro é o dono da linha do tempo; `READY` das imagens só no `onLoad`; atalhos tipo VLC/WMP (setas ±5 s, `Shift`+setas/PageUp/PageDown/N/P para item, teclas multimédia e códigos de telecomando de TV, `↑` retira o mudo) sem religar listeners a cada tick; ecrã inteiro no primeiro gesto (respeita a política de apresentação).

**Design (vidro, como na referência)**: barra de controlos e HUD com `rgba(20,18,44,.34)` + desfoque, ícones brancos, progresso violeta, barra compacta (780×128 px) para o conteúdo continuar visível.

## 3. Duração natural vs. definida na playlist
- `durationMs === 0` → **natural**: o `ended` nativo decide; o total mostrado é o do ficheiro.
- `durationMs > 0` → **janela fixa** (override da playlist): mais curta que o vídeo corta; mais longa **repete o vídeo dentro da janela**. A duração do ficheiro nunca é usada como janela, nem a janela como duração do ficheiro.
- Repetição da playlist: **já era o padrão** (`repeatMode: "PLAYLIST"` no React; módulo no `tv.js`). Agora com teste.

## 4. Validação

| Teste | Resultado |
|---|---|
| `test:device-media-range-live` (proxy, MP4 de 9 MB) | **15/15** — `206`, `Content-Range`, blocos ≤ 4 MB, sufixo, `416`, bytes idênticos, 401 sem token |
| `test:tv-video-live` (`tv.html` real emparelhado, Chrome) | **10/10** — vídeo visível, natural ≈ ficheiro, janela fixa ≈ 9,1 s com loop, volta ao início, `206` |
| `test:react-player-live` (player React, Chrome) | **15/15** — inclui item avariado (retry + salto, ERROR máx. 6,6 s), vidro, ecrã inteiro, ←/→ |
| `test:player-reliability` (contratos) | 14/14, no `npm test` |
| `npm test`, `typecheck`, `build` | PASS; lint 116/6/110 (baseline, 0 novos) |

**Antes/depois no `tv.js`** (mesmo teste, ficheiro original do `HEAD`): vídeo visível **0/4** amostras (destruído pelo redesenho do emparelhamento), janela fixa sem loop, 3.º item nunca chega. Com a correção: 10/10.

## 5. O que NÃO foi validado (e riscos)
- **Nenhum teste em hardware de Smart TV real.** Foi validado o runtime `tv.js` em Chrome desktop. Um `<video>` real de TV pode ainda falhar por **codec** (ex.: HEVC/H.265 ou 10-bit em TVs antigas); isso não se resolve no servidor. Agora a TV mostra a falha e regista o motivo em vez de saltar em silêncio.
- A leitura por intervalos no R2 usa `getObjectRange` (já usado em produção para detetar o tipo MIME); a validação ponta a ponta foi feita com o armazenamento local.
- Ecrã inteiro: os browsers exigem um gesto do utilizador; em TVs/quiosques que já correm em ecrã inteiro tenta logo.

## 6. Pendências identificadas na varredura (não tratadas aqui)
MÉDIA: `MEDIA_PLAY_ERROR` deixa o estado em `PAUSED` (raro: o autoplay mudo é permitido); sem indicador de buffering (`waiting`/`stalled`); sem pré-carregamento do item seguinte e playlist de 1 item recarrega o vídeo a cada volta; vídeo online não usa a cache IndexedDB como alternativa; estado `muted` pode divergir do elemento após o fallback de autoplay. BAIXA: volume/mudo não persistem; `ENDED` não pausa o elemento; `F` tratado em dois sítios; `seekAppliedRef` nunca reposto.

## 7. Como reproduzir
```
DATABASE_URL=file:./data/authz02-e2e.db MEDIA_STORAGE_PROVIDER=local MEDIA_LOCAL_DIR=./data/authz02-media npx next start -p 3150
BASE_URL=http://localhost:3150 npm run test:device-media-range-live
BASE_URL=http://localhost:3150 npm run test:tv-video-live
BASE_URL=http://localhost:3150 npm run test:react-player-live
```
(BD e armazenamento descartáveis; nunca contra dados reais.)
