# LANDING-HERO-05: Responsive QA

## Desktop (1280×720, 1366×768, 1440×900, 1536×864)
- **Top Spacing:** The Hero content now begins immediately after the designated structural padding (`pt-12`). The massive empty space between the Navbar and the Eyebrow is gone.
- **Copy Alignment:** The Eyebrow (Digital Display & Presentation) is perfectly anchored near the top alignment boundary of the grid.
- **Player Alignment:** The top of the Player card aligns with the top of the Copy block, preserving the exact height, structure, and media layout established in `LANDING-HERO-04`.
- **Bottom Spacing:** Because the Copy is top-aligned, there is natural whitespace below the Copy (above the Capabilities section), while the Player defines the overall height of the Hero row. This creates an elegant asymmetrical look that draws the eye horizontally to the impressive product demo.

## Mobile (375×812, 390×844) & Tablet (768×1024)
- **Single Column Flow:** The layout falls back to `grid-cols-1`.
- **Alignment:** Because `items-start` is applied, the text flows naturally from top to bottom. It does not stretch or attempt to center arbitrarily if container heights differ.
- **Order:** Copy -> CTA -> Player flow logically without strange gaps.
- **Overflow:** No horizontal overflow; scaling remains correct.
