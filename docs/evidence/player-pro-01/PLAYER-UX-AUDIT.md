# PLAYER-PRO-01 — Auditoria da interface

Auditoria **antes** de qualquer redesenho (a correcção funcional precede o polimento).

| Critério | Estado | Evidência / ficheiro |
|---|---|---|
| Reflecte o estado real do controlador | **Parcial** | Os botões lêem `state.status`/`state.muted`; o estado físico (elemento) não é lido (RC-03/04/14). Probe: `STOPPED` com vídeo a tocar (C3) |
| Distingue PLAYING / PAUSED / STOPPED / LOADING / ENDED / ERROR | **Parcial** | Controlos: apenas `PLAYING` vs "outros" (ícone ⏸/▶). `LOADING` e `ENDED` não têm indicação própria nos controlos; só `ERROR` mostra alerta + Retry. Não há indicador de *buffering* (`waiting/stalled` são ignorados) |
| Item actual e playlist | Parcial | `DisplayIdentityHud` mostra ecrã, playlist e "A reproduzir"; não mostra posição "2/5" nem o próximo |
| Progresso/duração só quando aplicáveis | **Bom** | `resolveControlAvailability`: seek só para AV com duração; barra de apresentação só para stills |
| Volume/mute sincronizados com o estado efectivo | **Falha** | `state.muted` pode ser falso com elemento mudo/pausado por política (RC-04). Botão mostra 🔊/"Mute" |
| Modo de repetição activo | **Falha parcial** | Rótulo inglês "Repeat PLAYLIST", ícones `↻ ¹ ↷` sem legenda, sem `aria-pressed`; **oculto em ecrãs ≤768 px**; um clique no padrão → `ITEM` (RC-07) |
| Botões aparentemente activos sem acção válida | **Falha** | EXPERIENCE: Play/Pause activo mas o runtime não pára (RC-06); `PLAYING` + elemento pausado: botão mostra "Pause" |
| Foco visível, teclado, áreas de toque | **Bom** | outline 2 px `:focus-visible`; alvos `minHeight 44`; teclado VLC/WMP (`use-playback-keyboard.ts`); sliders com `aria-*` |
| Responsivo (pequenos ecrãs / TV) | **Parcial** | `compact` (≤768 px) remove Stop, Restart, Volume, Repeat — funcionalidades essenciais (repetição) desaparecem; TVs usam `tv.js` (não React) |
| HUD/controlos não ocultam conteúdo essencial | **Bom** | vidro translúcido, auto-hide por inactividade, barra 780×128 px |
| Ecrã inteiro dependente de acção explícita | **Bom** | pedido no 1.º gesto, 1 tentativa, respeita política `WINDOWED` |
| Idioma | **Inconsistente** | Controlos em inglês ("Play", "Restart", "Retry", "Playback error"), restante produto em português |
| Ruído em consola de produção | LOW | `logVideoDiag` (`[VIDEO-DIAG]`) **não** está limitado a `development`; escreve ~10 linhas por item na consola de produção (src/currentSrc com token mascarado) |

## Prioridade UX (depois da correcção funcional)
1. Estado "A carregar/buffering" e "Som bloqueado — toque para activar" (estados reais, não decorativos).
2. Repetição legível e acessível (PT, `aria-pressed`, visível em compacto).
3. Ocultar/desactivar Play/Pause para EXPERIENCE ou fazê-lo agir realmente.
4. Traduzir rótulos e mensagens (`Retry` → "Tentar de novo"), posição "n/N" no HUD.
