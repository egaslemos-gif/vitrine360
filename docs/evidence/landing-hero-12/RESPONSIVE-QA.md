# LANDING-HERO-12: Responsive QA

## Desktop (1366x768 - 1536x864)
- **Player Natural Height:** The Player assumes a fixed aspect-ratio `5/4` for its Reader, yielding a height of ~316px, completely disregarding the much taller Left Column. The Player terminates gracefully before the bottom of the section.
- **Top/Bottom Spacing:** The distance from the Navbar to the Eyebrow is reduced for better density. The distance from the Player to the bottom of the section is now defined implicitly by the Left Column's `mt-16` margin pushing the Capability Rail down.
- **Clipping & Viewport:** The Reader correctly retains the `object-contain` property. No elements are cropped on the left side.

## Mobile (375x812, 390x844) & Tablet (768x1024)
- Grid layout accurately collapses into a 1-column layout (`grid-cols-1`).
- Reader safely falls back to `aspect-video` as programmed, preventing excessively tall readers on mobile devices.
- Playlist renders cleanly beneath the Reader, with natural height driven by flex-col behavior.
- Left column elements gracefully stack above the player, and the Capability Rail anchors below. No regressions introduced.
