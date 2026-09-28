# RESPONSIVE BREAKPOINTS

As requested, three distinct layout regimes have been enforced to prevent horizontal compression.

## Regime A — Desktop (>= 1280px `xl`)
- **Hero:** Two Columns (`HeroCopy | Player`)
- **Player Width:** Max `46vw` (capped at `700px`)
- **Player Structure:** Two Columns (`Reader | Playlist`)
- **Ratio:** `63% Reader / 37% Playlist`
- **Behavior:** The layout comfortably fits without compressing the Playlist text, avoiding abnormal stretching.

## Regime B — Tablet / Narrow Desktop (1024px - 1279px `lg`)
- **Hero:** Stacked (`HeroCopy` top, `Player` bottom)
- **Player Width:** Max `640px` (centered)
- **Player Structure:** Stacked (`Header`, `Reader`, `Playlist`)
- **Behavior:** By stacking at `1280px` (a breakpoint larger than 1024px as permitted by the instructions), we completely avoid the horizontal compression that occurred when cramming both columns and internal grids into an 1100px or 1024px screen.

## Regime C — Mobile (< 1024px)
- **Hero:** Stacked (`HeroCopy` top, `Player` bottom)
- **Player Structure:** Stacked (`Header`, `Reader`, `Playlist`)
- **Reader Aspect:** `16:9` (`aspect-video`)
- **Playlist Aspect:** Natural flow without internal scrollbars.
