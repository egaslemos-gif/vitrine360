# LANDING-HERO-04: Player Composition Modifications

## Problem
The Player component inside the Hero section previously used a side-by-side grid (`lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)]`), where the left column contained the `Header` and the `Media` container. Because the Grid columns stretch to match the tallest column (which was often the Playlist on the right), the left column ended up taller than the `aspect-video` Media container required. This resulted in empty white space below the Media and made the absolutely positioned controls appear floating too high up.

## Changes Implemented
1. **Header Relocation:** 
   Moved the `Header` component out of the inner Grid layout. It now sits as a direct child of the main card wrapper (`ui-demo-app-shell`), spanning the full width of the card. This logically separates the header from the content columns and guarantees no stretching mismatch between Header+Media vs Playlist.
2. **Dynamic Layout Strategy:**
   - **Hero (`size === "hero"`):** Modified the `Content` wrapper to use `flex flex-col` on desktop instead of a side-by-side grid. The Media column now fills the entire width of the card, creating a dominant `aspect-video` (16:9) viewport. The Playlist stacks neatly below it. This completely eliminates any blank space and gives the Player the appearance of a running product rather than a cropped screenshot.
   - **Showcase (`size === "showcase"`):** Preserved the side-by-side grid for the dedicated section further down the page where the container is wider (`max-w-6xl`), as this wider layout naturally accommodates a side-by-side composition without creating strange aspect ratios.
3. **Controls Placement:** By fixing the container stretching, the controls (which are anchored `bottom-0` to the `ui-player-canvas`) now correctly sit at the exact bottom boundary of the Media viewport, overlaying the video/image appropriately.
