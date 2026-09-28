# LANDING-HERO-08: Pre-Implementation Audit

## Problem Identified
The `LANDING-HERO-07` horizontal composition was structurally sound, but the internal sizing was suboptimal:
1. The Playlist items were too constrained vertically, triggering an internal scrollbar because 4 items couldn't fit within the strict `aspect-video` height of the Reader.
2. The Capability Rail at the bottom of the left column had an arbitrary `lg:mt-[4.5rem]` margin, which sometimes left it awkwardly placed if the Player size varied across different viewpoints.

## Constraints & Objectives
- **Playlist Breathing Room:** Increase item height to ~50-60px (`lg:min-h-[52px]`), increase thumbnail sizes slightly, and increase text readability without causing overflow.
- **Reader Aspect Ratio:** Allow a "pequena adaptação" to the `16:9` rule so the Reader provides enough height to accommodate the 4 items without scrolling.
- **Hero Column Balance:** Refactor the Left Column to use Flexbox so the Capability Rail is pushed dynamically to the bottom (`mt-auto`), perfectly aligning with the bottom edge of the Player.

## Action Plan
1. **InteractivePlayerDemo.tsx:**
   - Change desktop grid to `lg:grid-cols-[minmax(0,1.8fr)_minmax(220px,1fr)]` (giving the Playlist slightly more width).
   - Change the Reader's canvas to `lg:aspect-[16/11]` which increases its height just enough.
   - Increase Playlist padding, item gaps (`lg:space-y-2`), and item sizing (`lg:min-h-[52px]`).
   - Enlarge Thumbnails to `lg:h-[34px] lg:w-[60px]`.
2. **LandingPage.tsx:**
   - On the hero grid, change `items-start` to `lg:items-stretch` so both columns occupy equal height.
   - On the Left Column, add `flex flex-col` and replace the arbitrary `lg:mt-[4.5rem]` on the Capability Rail with `lg:mt-auto`.
