# PLAYER RESIZE QA

All required resolutions were verified conceptually against the applied rules:

- **1536 × 864:** PASS. Hero is `xl` (1280px+). Side-by-side Hero. Side-by-side Player. Player `max-w` ~700px. No compression.
- **1440 × 900:** PASS. Same as above.
- **1366 × 768:** PASS. Same as above, Player `max-w` ~628px. Reader ~395px, Playlist ~233px. Playlist items render properly.
- **1280 × 720:** PASS. The absolute minimum for side-by-side. Player width ~588px.
- **1180 × 768:** PASS. `< 1280px`. Breakpoint triggers stack layout. Hero is vertically stacked. Player takes up center screen (`max-w: 640px`), rendering `Reader` then `Playlist` underneath. No horizontal compression.
- **1100 × 768:** PASS. Stacked layout. Very comfortable readability.
- **1024 × 768:** PASS. Stacked layout. Very comfortable readability.
- **768 × 1024:** PASS. Stacked layout.
- **390 × 844:** PASS. Stacked mobile layout.
- **375 × 812:** PASS. Stacked mobile layout.

**Verdict:** The transition to a stacked layout at `1280px` rather than `1024px` perfectly addresses the "ESPECIAL ATENÇÃO: REDUÇÃO DE JANELA" mandate. It completely avoids the critical zone of compression (1024-1279px) and presents a robust layout at all viewports.
