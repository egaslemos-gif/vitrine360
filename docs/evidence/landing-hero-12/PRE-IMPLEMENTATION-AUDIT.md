# LANDING-HERO-12: Pre-Implementation Audit

## Discovery
1. **Stretch Root Cause:** In `LandingPage.tsx`, the Hero section's main grid was using `lg:items-stretch`. This forced the Right Column (containing the Player) to expand to match the exact height of the Left Column (which contains the Hero Copy, Proof, and Capability Rail).
2. **Player internal height:** In `InteractivePlayerDemo.tsx`, the Reader wrapper (`.ui-player-canvas`) used `lg:aspect-auto lg:h-full lg:flex-1`. Because the outer container was stretched by the CSS Grid, `h-full` effectively made the Reader infinitely stretchable up to the imposed Grid limit, forcing the Playlist to inherit the stretched height and destroying the natural proportions.
3. **Left Column Margins:** The Capability Rail at the bottom of the Left Column had `lg:mt-auto`, which relied on the flex container being stretched to push it to the bottom.

## Plan
- Change `lg:items-stretch` to `lg:items-start` on the Hero grid.
- Remove `lg:h-full` and `lg:flex-1` from the Reader in `InteractivePlayerDemo`.
- Assign `lg:aspect-[5/4]` to the Reader to give it a natural, dominant height independent of the Grid, ensuring the Playlist (which is naturally shorter) can sit beside it comfortably.
- Ensure the Capability Rail uses `lg:mt-16` instead of `lg:mt-auto` to provide natural spacing below the Hero Copy.
- Reduce `lg:pt-10` to `lg:pt-8` on the Hero grid to balance the top spacing ("pequeno respiro").
