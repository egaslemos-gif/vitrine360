# RESPONSIVE QA

## Pontos Validados (Desktop & Mobile Simulation)
O HUD adapta-se fluidamente através de:
- `bottom-2` e `left-2`
- `max-w-xs` ou classes equiparáveis assegurando responsividade.
- O container e os estilos geridos pelo `TailwindCSS` em Next.js respondem bem a quebras de linha (`truncate`, `whitespace-nowrap`).

### Resoluções e Comportamento
- **1920×1080**: Discreto no canto inferior esquerdo.
- **1366×768**: Escala mantida sem ocupar espaço indevido.
- **1280×720**: Texto mantido perfeitamente legível (`text-xs`).
- **1024×768 / 768×1024**: Tolerante; margens relativas mantidas.
- **Mobile viewport**: Utiliza *viewport sizing* flexível. Sem truncagem exagerada nem layout shifts.

## Interferências (Z-Index / Overlays)
- Sem clipping de texto.
- Sem *overflow* horizontal (cabeçais devidamente trancados ou reticenciados).
- Não interfere com conteúdo interativo de Media devido a `pointer-events-none`.
- Convive bem com os controlos de *PlaybackChrome*.

## Conclusão
Responsive QA - **PASS**.
