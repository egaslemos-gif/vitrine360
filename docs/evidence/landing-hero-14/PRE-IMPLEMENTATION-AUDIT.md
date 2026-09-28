# PRE-IMPLEMENTATION AUDIT

## Observations

1. **Card Proximity to Navbar:** The outer PlayerCard was placed tightly within the Hero Grid. With `p-1.5 sm:p-2` on the glassmorphism wrapper and no specific top-margin adjustment, it visually touched or was uncomfortably close to the Navbar's drop shadow/glow.
2. **Double Padding Issue:** There was padding inside the LandingPage component (`p-1.5`) and no padding inside the InteractivePlayerDemo to isolate the Reader. This resulted in the Reader touching the inner edges of the player shell instead of breathing within it.
3. **Card Height & Stretch Elements:** The `ui-demo-app-shell` contained `h-full`, which instructed the player to fill its container if the container allowed it, sometimes creating artificial height.
4. **Header Size:** The Player Header had `py-2.5`, which felt slightly cramped.
5. **Playlist Width Constraint:** The internal Grid was `minmax(0,1.85fr)_minmax(240px,1fr)`. At narrow desktop viewports, `1.85fr` would collapse because `240px` was forcefully occupying too large of a percentage of the ~500-600px available width.
