# PRE-IMPLEMENTATION AUDIT

## Layout Constraints
- Hero Grid in `LandingPage.tsx` was configured to switch to a two-column layout at `lg` (1024px).
- At 1024px, the Right Column `max-w` restricted the Player width to ~471px.
- The inner Player grid switched to `Reader | Playlist` at `lg` (1024px) with a ratio of 1.7fr / 1fr (63% / 37%).
- Playlist natural height was ~314px (4 items, titles, metadata, padding).
- Reader width was ~296px. If `aspect-[5/4]` was applied, its height was ~236px.

## Issues Identified
1. **Vertical Disproportion:** At viewports between 1024px and 1280px, the Player became overly compressed horizontally.
2. **Artificial Reader Height Requirement:** To prevent whitespace below the Reader when the Playlist dictates the row height, the Reader was forced into `aspect-[5/4]`. This caused letterboxing (zonas negras) on 16:9 media.
3. **Stretch Rules:** While `items-start` was applied to the Hero Grid, the internal Player grid lacked `items-start`, meaning the `Playlist` height dictated the row height, and the Reader wrapper stretched, creating empty space.
4. **App Shell h-full:** The inner `ui-demo-app-shell` had `h-full`, which in some contexts acts as a stretch driver if the parent is a grid item without `items-start`.
