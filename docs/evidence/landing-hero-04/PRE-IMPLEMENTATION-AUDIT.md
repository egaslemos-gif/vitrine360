# LANDING-HERO-04: Pre-Implementation Audit

## Identified Issues
1. **Header Positioning:** The `Header` ("Vitrine360 Player") is currently located *inside* the first column of the grid, directly above the Media. This reduces the available width/height for the media and ties the header to the left column.
2. **Empty White Space:** On desktop Hero (`size="hero"`), the Player uses a side-by-side grid (`lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)]`). The right column (Playlist) is approximately 250px tall. The left column (Header + Media) is constrained by width, so the `aspect-video` Media ends up being around 225px tall. Because grid columns stretch by default, the left column stretches to 250px, leaving an empty white gap below the Media.
3. **Controls Placement:** The `ControlBar` is positioned absolutely at the bottom of `ui-player-canvas`. Because `ui-player-canvas` doesn't fill the stretched column (due to `aspect-video` keeping it short), the controls appear visually "too high" within the card, sitting above the empty white space.
4. **Hero Spacing:** The Hero layout still has `pt-16 pb-20` on desktop, which can be further compacted to `pt-12 pb-16` to reduce the Navbar -> Hero gap.

## Action Plan
1. **Restructure Player Card:** 
   - Move the `Header` to the top level of `ui-demo-app-shell`, outside the content grid.
   - For `size="hero"`, change the layout to a single column (`grid-cols-1`) so the Media Viewport takes the full width (up to 640px), becoming the visually dominant element with a strict 16:9 aspect ratio.
   - Place the Playlist directly below the Media.
2. **Adjust Controls:** Since the Media will now span the full width and define its own space without stretching weirdly, the `absolute bottom-0` controls will naturally sit exactly at the bottom of the media viewport.
3. **Reduce Hero Padding:** In `LandingPage`, adjust the padding to `pt-12 pb-16` (desktop), `pt-10 pb-12` (tablet) to make it even more compact.
4. **Preserve Playlist & Logic:** Keep the Playlist items and `InteractivePlayerDemo` internal state/logic strictly untouched.
